/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { FamilyDB, hashPassword } from "./server/db.js";
import { UserRole } from "./src/types.js";

const app = express();
const PORT = 3000;

// Body parser - supports rich receipt images in finances
app.use(express.json({ limit: "15mb" }));

// Server-Sent Events client pool for real-time synchronization
let sseClients: Response[] = [];

// Realtime sync broadcast helper
function broadcastSyncEvent(eventType: string, extraData: any = {}) {
  const payload = JSON.stringify({ type: eventType, timestamp: new Date().toISOString(), ...extraData });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (e) {
      console.error("SSE broadcast write failed:", e);
    }
  });
}

// Authentication middleware to extract current user session
interface AuthRequest extends Request {
  userSession?: {
    userId: string;
    username: string;
    fullName: string;
    role: UserRole;
  };
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const userId = authHeader.split(" ")[1];
  const users = FamilyDB.getUsers();
  const matchedUser = users.find(u => u.id === userId);

  if (matchedUser) {
    req.userSession = {
      userId: matchedUser.id,
      username: matchedUser.username,
      fullName: matchedUser.fullName,
      role: matchedUser.role
    };
  }
  next();
};

app.use(authMiddleware as any);

// Enforce authentication on APIs
const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userSession) {
    res.status(401).json({ error: "Vui lòng đăng nhập để thực hiện tác vụ này!" });
    return;
  }
  next();
};

// Enforce specific role level
const requireRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userSession) {
      res.status(401).json({ error: "Bạn chưa đăng nhập!" });
      return;
    }
    if (!roles.includes(req.userSession.role)) {
      res.status(403).json({ error: `Tài khoản của bạn (${req.userSession.role}) không được phép thực hiện thao tác này!` });
      return;
    }
    next();
  };
};

// --- AUTH API ENDPOINTS ---

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: "Vui lòng nhập đầy đủ tài khoản và mật khẩu!" });
    return;
  }

  const users = FamilyDB.getUsers();
  const user = users.find(u => u.username === username.toLowerCase().trim());

  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác!" });
    return;
  }

  // Record login activity
  FamilyDB.logActivity(user.id, user.username, "Đăng nhập", `Đã đăng nhập thành công vào hệ thống.`);

  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.get("/api/auth/me", (req: AuthRequest, res: Response) => {
  if (!req.userSession) {
    res.status(401).json({ error: "Không tìm thấy phiên làm việc!" });
    return;
  }
  const users = FamilyDB.getUsers();
  const user = users.find(u => u.id === req.userSession?.userId);
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy người dùng!" });
    return;
  }
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser });
});

// --- REALTIME SSE CONNECTION FOR REPLICATION ---

app.get("/api/realtime", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  // Pulse to keep alive
  res.write(`data: ${JSON.stringify({ type: "init", message: "Đã thiết lập kết nối thời gian thực" })}\n\n`);

  sseClients.push(res);

  req.on("close", () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// --- TASK API ENDPOINTS ---

app.get("/api/tasks", requireAuth, (req: AuthRequest, res: Response) => {
  const tasks = FamilyDB.getTasks();
  res.json({ tasks });
});

app.post("/api/tasks", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  
  // Guard write permissions - guest role cannot edit tasks other than their assigned ones or create new tasks freely
  if (session.role === UserRole.GUEST && req.body.id && !req.body.comments) {
    const existing = FamilyDB.getTasks().find(t => t.id === req.body.id);
    if (existing && existing.assigneeId !== session.userId) {
      res.status(403).json({ error: "Tài khoản khách chỉ được sửa đổi trạng thái công việc của chính mình!" });
      return;
    }
  }

  try {
    const savedTask = FamilyDB.saveTask(req.body, session.userId, session.username);
    broadcastSyncEvent("TASKS_UPDATE", { taskId: savedTask.id });
    res.json({ task: savedTask });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/tasks/:id/comments", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === "") {
    res.status(400).json({ error: "Nội dung bình luận không được bỏ trống!" });
    return;
  }

  try {
    const updatedTask = FamilyDB.addCommentToTask(id, content, session.userId, session.username);
    broadcastSyncEvent("TASKS_UPDATE", { taskId: id });
    res.json({ task: updatedTask });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/tasks/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;

  try {
    FamilyDB.deleteTask(id, session.userId, session.username);
    broadcastSyncEvent("TASKS_UPDATE", { deletedId: id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- PLANS / SCHEDULE API ENDPOINTS ---

app.get("/api/plans", requireAuth, (req: AuthRequest, res: Response) => {
  const plans = FamilyDB.getPlans();
  res.json({ plans });
});

app.post("/api/plans", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const savedPlan = FamilyDB.savePlan(req.body, session.userId, session.username);
    broadcastSyncEvent("PLANS_UPDATE", { planId: savedPlan.id });
    res.json({ plan: savedPlan });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/plans/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;

  try {
    FamilyDB.deletePlan(id, session.userId, session.username);
    broadcastSyncEvent("PLANS_UPDATE", { deletedId: id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- NOTES API ENDPOINTS ---

app.get("/api/notes", requireAuth, (req: AuthRequest, res: Response) => {
  const notes = FamilyDB.getNotes();
  res.json({ notes });
});

app.post("/api/notes", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const noteData = req.body;

  // Role validation for modification
  if (noteData.id) {
    const existing = FamilyDB.getNotes().find(n => n.id === noteData.id);
    if (existing) {
      // Check author or edit permission
      if (existing.creatorId !== session.userId && !existing.allowedRolesToEdit.includes(session.role)) {
        res.status(403).json({ error: "Bạn không có quyền sửa ghi chú này!" });
        return;
      }
    }
  }

  try {
    const savedNote = FamilyDB.saveNote(noteData, session.userId, session.username);
    broadcastSyncEvent("NOTES_UPDATE", { noteId: savedNote.id });
    res.json({ note: savedNote });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/notes/:id", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;

  const existing = FamilyDB.getNotes().find(n => n.id === id);
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy ghi chú" });
    return;
  }

  if (existing.creatorId !== session.userId && session.role !== UserRole.ADMIN) {
    res.status(403).json({ error: "Chỉ người tạo hoặc Admin mới được xóa ghi chú này!" });
    return;
  }

  try {
    FamilyDB.deleteNote(id, session.userId, session.username);
    broadcastSyncEvent("NOTES_UPDATE", { deletedId: id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- FINANCIAL API ENDPOINTS ---

app.get("/api/finance", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const transactions = FamilyDB.getTransactions();
  res.json({ transactions });
});

app.post("/api/finance", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const savedTx = FamilyDB.saveTransaction(req.body, session.userId, session.username);
    broadcastSyncEvent("FINANCE_UPDATE", { txId: savedTx.id });
    res.json({ transaction: savedTx });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/finance/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;

  try {
    FamilyDB.deleteTransaction(id, session.userId, session.username);
    broadcastSyncEvent("FINANCE_UPDATE", { deletedId: id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- USER MANAGEMENT ENDPOINTS ---

app.get("/api/users", requireAuth, (req: AuthRequest, res: Response) => {
  const users = FamilyDB.getUsers().map(u => {
    const { passwordHash, ...safe } = u;
    return safe;
  });
  res.json({ users });
});

app.post("/api/users", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { username, fullName, role, passwordPlain, avatarColor } = req.body;

  if (!username || !fullName || !role || !passwordPlain) {
    res.status(400).json({ error: "Vui lòng nhập đầy đủ chi tiết thành viên mới!" });
    return;
  }

  try {
    const newUser = FamilyDB.createUser({
      username,
      fullName,
      role,
      passwordPlain,
      avatarColor
    }, session.userId, session.username);

    broadcastSyncEvent("USERS_UPDATE");
    res.json({ user: newUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- NOTIFICATIONS ENDPOINTS ---

app.get("/api/notifications", requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userSession!.userId;
  const list = FamilyDB.getNotifications().filter(n => n.userId === "all" || n.userId === userId);
  res.json({ notifications: list });
});

app.post("/api/notifications/:id/read", requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userSession!.userId;
  const { id } = req.params;
  FamilyDB.markNotificationRead(id, userId);
  res.json({ success: true });
});

app.post("/api/notifications/read-all", requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userSession!.userId;
  FamilyDB.markAllNotificationsRead(userId);
  res.json({ success: true });
});

// --- LOGS & BACKUPS (ADMIN ONLY) ---

app.get("/api/admin/logs", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const logs = FamilyDB.getActivityLogs();
  res.json({ logs });
});

app.get("/api/admin/backups", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const backups = FamilyDB.getBackups();
  res.json({ backups });
});

app.post("/api/admin/backups", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const info = FamilyDB.createBackup("manual", session.userId, session.username);
    broadcastSyncEvent("BACKUPS_UPDATE");
    res.json({ success: true, ...info });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/backups/:id", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;
  try {
    FamilyDB.deleteBackup(id, session.userId, session.username);
    broadcastSyncEvent("BACKUPS_UPDATE");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/backups/:id/restore", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;
  try {
    FamilyDB.restoreBackup(id, session.userId, session.username);
    broadcastSyncEvent("RESTORE_COMPLETED");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- VITE MIDDLEWARE SETUP & STATIC SERVING ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Periodic automatic daily backup mechanism
  setInterval(() => {
    try {
      console.log("Đang chạy backup dữ liệu tự động định kỳ...");
      FamilyDB.createBackup("auto", "system", "Hệ thống");
    } catch (e) {
      console.error("Lỗi tự động sao lưu dữ liệu:", e);
    }
  }, 1000 * 60 * 60 * 24); // Every 24 hours

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
