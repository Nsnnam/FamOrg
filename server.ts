/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { FamilyDB, verifyPassword, getSessionSecret } from "./server/db.js";
import { UserRole } from "./src/types.js";

const app = express();
const PORT = 3000;

// Body parser - supports rich receipt images in finances
app.use(express.json({ limit: "15mb" }));

// --- SESSION TOKEN SIGNING ---
// Tokens are stateless: "userId.HMAC(userId)". They cannot be forged without the
// per-install secret, so a guessable userId alone is no longer a valid session.
const SESSION_SECRET = getSessionSecret();

function signToken(userId: string): string {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

function verifyToken(token: string): string | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  const userId = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

// --- SIMPLE LOGIN RATE LIMITING (in-memory, per IP) ---
const loginAttempts = new Map<string, { count: number; first: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;

function isRateLimited(ip: string): boolean {
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > RATE_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return rec.count >= RATE_MAX;
}

function recordLoginFailure(ip: string): void {
  const rec = loginAttempts.get(ip);
  if (!rec || Date.now() - rec.first > RATE_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, first: Date.now() });
  } else {
    rec.count += 1;
  }
}

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

  const token = authHeader.split(" ")[1];
  const userId = verifyToken(token);
  if (!userId) {
    next();
    return;
  }

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
  const ip = req.ip || "unknown";

  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại!" });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ error: "Vui lòng nhập đầy đủ tài khoản và mật khẩu!" });
    return;
  }

  const users = FamilyDB.getUsers();
  const user = users.find(u => u.username === username.toLowerCase().trim());

  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordLoginFailure(ip);
    res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác!" });
    return;
  }

  // Successful login clears the failure counter
  loginAttempts.delete(ip);

  // Record login activity
  FamilyDB.logActivity(user.id, user.username, "Đăng nhập", `Đã đăng nhập thành công vào hệ thống.`);

  // Refresh birthday reminders on each login so they stay current
  try {
    FamilyDB.generateBirthdayNotifications();
  } catch (e) {
    console.error("Lỗi tạo nhắc sinh nhật:", e);
  }

  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser, token: signToken(user.id) });
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

app.post("/api/auth/change-password", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới!" });
    return;
  }

  try {
    FamilyDB.changePassword(session.userId, currentPassword, newPassword);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
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

// --- REWARDS API ENDPOINTS ---

app.get("/api/rewards", requireAuth, (req: AuthRequest, res: Response) => {
  const entries = FamilyDB.getRewardLedger();
  const totals: Record<string, number> = {};
  entries.forEach(entry => {
    totals[entry.userId] = (totals[entry.userId] || 0) + entry.points;
  });
  res.json({ entries, totals });
});

app.post("/api/rewards", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const entry = FamilyDB.addRewardEntry(req.body, session.userId, session.username);
    broadcastSyncEvent("REWARDS_UPDATE", { rewardId: entry.id });
    res.json({ entry });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- BUDGET + RECURRING BILL API ENDPOINTS ---

app.get("/api/finance/budgets", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  res.json({ budgets: FamilyDB.getBudgets() });
});

app.post("/api/finance/budgets", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const budget = FamilyDB.saveBudget(req.body, session.userId, session.username);
    broadcastSyncEvent("FINANCE_UPDATE", { budgetId: budget.id });
    res.json({ budget });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/finance/budgets/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  FamilyDB.deleteBudget(req.params.id);
  broadcastSyncEvent("FINANCE_UPDATE", { deletedBudgetId: req.params.id });
  res.json({ success: true });
});

app.get("/api/finance/recurring-bills", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  res.json({ recurringBills: FamilyDB.getRecurringBills() });
});

app.post("/api/finance/recurring-bills", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const bill = FamilyDB.saveRecurringBill(req.body, session.userId, session.username);
    broadcastSyncEvent("FINANCE_UPDATE", { billId: bill.id });
    res.json({ bill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/finance/recurring-bills/:id/pay", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const result = FamilyDB.payRecurringBill(req.params.id, session.userId, session.username);
    broadcastSyncEvent("FINANCE_UPDATE", { billId: result.bill.id, txId: result.transaction.id });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/finance/recurring-bills/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  FamilyDB.deleteRecurringBill(req.params.id);
  broadcastSyncEvent("FINANCE_UPDATE", { deletedBillId: req.params.id });
  res.json({ success: true });
});

// --- MEDICATION API ENDPOINTS ---

app.get("/api/medications", requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ medications: FamilyDB.getMedications() });
});

app.post("/api/medications", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const medication = FamilyDB.saveMedication(req.body, session.userId, session.username);
    broadcastSyncEvent("MEDICATIONS_UPDATE", { medicationId: medication.id });
    res.json({ medication });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/medications/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  FamilyDB.deleteMedication(req.params.id);
  broadcastSyncEvent("MEDICATIONS_UPDATE", { deletedId: req.params.id });
  res.json({ success: true });
});

// --- AI ASSISTANT API ---

app.post("/api/assistant/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const message = String(req.body?.message || "").trim();
  if (!message) {
    res.status(400).json({ error: "Vui long nhap cau hoi cho tro ly" });
    return;
  }
  if (!apiKey) {
    res.status(400).json({ error: "Chua cau hinh GEMINI_API_KEY cho AI assistant" });
    return;
  }

  try {
    const [{ GoogleGenAI }] = await Promise.all([import("@google/genai")]);
    const ai = new GoogleGenAI({ apiKey });
    const tasks = FamilyDB.getTasks().slice(-30);
    const plans = FamilyDB.getPlans().slice(-30);
    const transactions = FamilyDB.getTransactions().slice(-30);
    const medications = FamilyDB.getMedications();
    const prompt = [
      "Ban la tro ly gia dinh trong app Family Organizer. Tra loi ngan gon bang tieng Viet, uu tien viec co the lam ngay.",
      `Nguoi hoi: ${req.userSession?.fullName}`,
      `Tasks gan day: ${JSON.stringify(tasks)}`,
      `Lich gan day: ${JSON.stringify(plans)}`,
      `Giao dich gan day: ${JSON.stringify(transactions)}`,
      `Lich thuoc: ${JSON.stringify(medications)}`,
      `Cau hoi: ${message}`
    ].join("\n\n");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    res.json({ answer: response.text || "Minh chua co cau tra loi phu hop." });
  } catch (err: any) {
    console.error("Assistant error:", err);
    res.status(500).json({ error: err.message || "AI assistant dang gap loi" });
  }
});

// --- SHOPPING LIST ENDPOINTS ---

app.get("/api/shopping", requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ shoppingItems: FamilyDB.getShoppingItems() });
});

app.post("/api/shopping", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  if (!req.body.id && (!req.body.name || !req.body.name.trim())) {
    res.status(400).json({ error: "Vui lòng nhập tên món đồ cần mua!" });
    return;
  }
  try {
    const item = FamilyDB.saveShoppingItem(req.body, session.userId, session.username);
    broadcastSyncEvent("SHOPPING_UPDATE", { itemId: item.id });
    res.json({ item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/shopping/:id/toggle", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    const item = FamilyDB.toggleShoppingItem(req.params.id, session.userId);
    broadcastSyncEvent("SHOPPING_UPDATE", { itemId: item.id });
    res.json({ item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Note: this must be declared before the "/:id" route so "purchased" isn't treated as an id.
app.delete("/api/shopping/purchased", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const removed = FamilyDB.clearPurchasedShopping(session.userId, session.username);
  broadcastSyncEvent("SHOPPING_UPDATE");
  res.json({ removed });
});

app.delete("/api/shopping/:id", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  try {
    FamilyDB.deleteShoppingItem(req.params.id, session.userId, session.username);
    broadcastSyncEvent("SHOPPING_UPDATE", { deletedId: req.params.id });
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
  const { username, fullName, role, passwordPlain, avatarColor, dateOfBirth, phone } = req.body;

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
      avatarColor,
      dateOfBirth,
      phone
    }, session.userId, session.username);

    broadcastSyncEvent("USERS_UPDATE");
    res.json({ user: newUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Self-service profile update: a user can edit their OWN personal info only.
app.post("/api/profile", requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { fullName, dateOfBirth, phone, avatarImage, avatarColor } = req.body;

  try {
    const updated = FamilyDB.updateProfile(session.userId, {
      fullName,
      dateOfBirth,
      phone,
      avatarImage,
      avatarColor
    });
    broadcastSyncEvent("USERS_UPDATE", { updatedId: session.userId });
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/users/:id", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;

  try {
    FamilyDB.deleteUser(id, session.userId, session.username);
    broadcastSyncEvent("USERS_UPDATE", { deletedId: id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/users/:id/reset-password", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    res.status(400).json({ error: "Vui lòng nhập mật khẩu mới!" });
    return;
  }

  try {
    FamilyDB.adminResetPassword(id, newPassword, session.userId, session.username);
    res.json({ success: true });
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

// --- DASHBOARD WIDGETS (weather / crypto / gold / fx) ---
// Server-side proxy with caching: avoids CORS, respects rate limits, and keeps
// serving the last known value if an upstream call fails.

// Weather location (TP. Hồ Chí Minh). Change here to relocate.
const WEATHER_LAT = 10.7769;
const WEATHER_LON = 106.7009;
const WEATHER_CITY = "TP. Hồ Chí Minh";

const widgetCache: Record<string, { data: any; ts: number }> = {};

async function cachedFetch(key: string, ttlMs: number, fetcher: () => Promise<any>): Promise<any> {
  const entry = widgetCache[key];
  if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
  try {
    const data = await fetcher();
    widgetCache[key] = { data, ts: Date.now() };
    return data;
  } catch (e) {
    console.error(`Widget '${key}' fetch lỗi:`, e);
    return entry ? entry.data : null; // serve stale data on error
  }
}

async function fetchWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FHo_Chi_Minh&forecast_days=3`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`weather HTTP ${r.status}`);
  const j: any = await r.json();
  return { city: WEATHER_CITY, current: j.current, daily: j.daily };
}

async function fetchCrypto() {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,vnd&include_24hr_change=true";
  const r = await fetch(url);
  if (!r.ok) throw new Error(`crypto HTTP ${r.status}`);
  return await r.json();
}

async function fetchFx() {
  const r = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!r.ok) throw new Error(`fx HTTP ${r.status}`);
  const j: any = await r.json();
  return { usdVnd: j.rates?.VND ?? null, updated: j.time_last_update_utc ?? null };
}

const VANG_TODAY_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json, text/plain, */*"
};

function marketNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickVangTodayQuote(payload: any, code: string): any | null {
  if (!payload || typeof payload !== "object") return null;

  if (payload.type === code || payload.type_code === code) return payload;

  if (payload.prices && typeof payload.prices === "object" && payload.prices[code]) {
    return { type: code, ...payload.prices[code] };
  }

  const list: any[] = Array.isArray(payload.data) ? payload.data : [];
  return list.find(it => it?.type === code || it?.type_code === code) ?? null;
}

async function fetchVangTodayQuote(code: string) {
  const r = await fetch(`https://www.vang.today/api/prices?type=${encodeURIComponent(code)}`, {
    headers: VANG_TODAY_HEADERS
  });
  if (!r.ok) throw new Error(`vang.today ${code} HTTP ${r.status}`);
  const payload: any = await r.json();
  return { payload, quote: pickVangTodayQuote(payload, code) };
}

async function fetchGold(usdVnd: number | null) {
  // Prefer Vietnam SJC price from vang.today (VND/tael, free, no key).
  try {
    const { payload, quote } = await fetchVangTodayQuote("SJL1L10");
    const sell = marketNumber(quote?.sell);
    if (sell && sell > 0) {
      const buy = marketNumber(quote?.buy);
      const changeSell = marketNumber(quote?.change_sell) ?? 0;
      const prevSell = sell - changeSell;
      const changePct = prevSell ? (changeSell / prevSell) * 100 : null;
      return {
        source: quote?.name ? `Vàng ${quote.name}` : "Vàng SJC",
        buy,
        sell,
        changePct,
        updated: quote?.update_time ?? payload.timestamp ?? payload.current_time ?? null
      };
    }
    throw new Error("vang.today SJL1L10 response missing sell price");
  } catch (e) {
    console.error("Gold vang.today SJC loi, dung XAUUSD:", e);
  }

  // Fallback to world gold from the same provider.
  const { payload, quote } = await fetchVangTodayQuote("XAUUSD");
  const usdPerOz = marketNumber(quote?.sell) || marketNumber(quote?.buy);
  if (!usdPerOz) throw new Error("vang.today XAUUSD response missing price");

  const change = marketNumber(quote?.change_sell) || marketNumber(quote?.change_buy) || 0;
  const prev = usdPerOz - change;
  const changePct = prev ? (change / prev) * 100 : null;
  let vndPerTael: number | null = null;
  if (usdVnd) {
    // Approximate VND per tael (1 tael = 37.5g, 1 troy oz = 31.1035g).
    vndPerTael = Math.round((usdPerOz / 31.1035) * 37.5 * usdVnd);
  }
  return {
    source: "Vàng thế giới (XAU, tham khảo)",
    usdPerOz,
    changePct,
    vndPerTael,
    updated: quote?.update_time ?? payload.timestamp ?? payload.current_time ?? null
  };
}

app.get("/api/widgets/overview", requireAuth, async (req: AuthRequest, res: Response) => {
  const weather = await cachedFetch("weather", 15 * 60 * 1000, fetchWeather);
  const cryptoPrices = await cachedFetch("crypto", 5 * 60 * 1000, fetchCrypto);
  const fx = await cachedFetch("fx", 30 * 60 * 1000, fetchFx);
  const gold = await cachedFetch("gold", 30 * 60 * 1000, () => fetchGold(fx?.usdVnd ?? null));
  res.json({ weather, crypto: cryptoPrices, fx, gold });
});

// --- VITE MIDDLEWARE SETUP & STATIC SERVING ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ["**/data/**"]
        }
      },
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

  // Generate birthday + deadline reminders once at boot
  try {
    FamilyDB.generateBirthdayNotifications();
    FamilyDB.generateReminders();
  } catch (e) {
    console.error("Lỗi tạo nhắc nhở lúc khởi động:", e);
  }

  // Check deadline/event reminders every 30 minutes (fine-grained for the 1-hour window)
  setInterval(() => {
    try {
      FamilyDB.generateReminders();
      broadcastSyncEvent("NOTIFICATIONS_UPDATE");
    } catch (e) {
      console.error("Lỗi tạo nhắc deadline định kỳ:", e);
    }
  }, 30 * 60 * 1000);

  // Periodic automatic daily backup + birthday reminder refresh
  setInterval(() => {
    try {
      console.log("Đang chạy backup dữ liệu tự động định kỳ...");
      FamilyDB.createBackup("auto", "system", "Hệ thống");
    } catch (e) {
      console.error("Lỗi tự động sao lưu dữ liệu:", e);
    }
    try {
      FamilyDB.generateBirthdayNotifications();
    } catch (e) {
      console.error("Lỗi tạo nhắc sinh nhật định kỳ:", e);
    }
  }, 1000 * 60 * 60 * 24); // Every 24 hours

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
