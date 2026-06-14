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
import { UserRole, isLimitedViewer } from "./src/types.js";
import { saveDataUrlToFile, UPLOADS_DIR } from "./server/media.js";
import { getVapidPublicKey, isPushConfigured, sendTestPush } from "./server/push.js";

// Accepted permission roles for write validation
const VALID_ROLES = new Set<string>([UserRole.ADMIN, UserRole.MEMBER, UserRole.CHILD, UserRole.GUEST]);
const MAX_AVATAR_IMAGE_CHARS = 2_500_000;

// Images are stored either as "/uploads/..." file references (new) or, for older
// records, inline base64 "data:image/..." URLs. Both are accepted on write.
function isStoredImageRef(value: string): boolean {
  return value.startsWith("/uploads/") || value.startsWith("data:image/");
}

function validateAvatarImagePayload(avatarImage: unknown) {
  if (avatarImage === undefined || avatarImage === "") return;
  if (typeof avatarImage !== "string" || !isStoredImageRef(avatarImage)) {
    throw new Error("Ảnh đại diện không hợp lệ.");
  }
  // Length cap only matters for inline base64; file refs are short.
  if (avatarImage.startsWith("data:image/") && avatarImage.length > MAX_AVATAR_IMAGE_CHARS) {
    throw new Error("Ảnh đại diện sau khi tối ưu vẫn quá lớn. Vui lòng chọn ảnh khác.");
  }
}

const MAX_ASSET_PHOTOS = 8;
const MAX_ASSET_PHOTO_CHARS = 2_500_000;

function validateImageRef(value: unknown, label: string, maxChars: number) {
  if (typeof value !== "string" || !isStoredImageRef(value)) {
    throw new Error(`${label} không hợp lệ.`);
  }
  if (value.startsWith("data:image/") && value.length > maxChars) {
    throw new Error(`${label} quá lớn. Vui lòng để app tối ưu ảnh trước khi lưu.`);
  }
}

function validateAssetPhotosPayload(photos: unknown) {
  if (photos === undefined) return;
  if (!Array.isArray(photos)) throw new Error("Danh sách ảnh tài sản không hợp lệ.");
  if (photos.length > MAX_ASSET_PHOTOS) {
    throw new Error(`Mỗi tài sản chỉ nên lưu tối đa ${MAX_ASSET_PHOTOS} ảnh.`);
  }

  photos.forEach((photo, idx) => {
    if (!photo || typeof photo !== "object") throw new Error(`Ảnh tài sản #${idx + 1} không hợp lệ.`);
    const item = photo as any;
    validateImageRef(item.thumbnailDataUrl, `Ảnh thu nhỏ #${idx + 1}`, 500_000);
    validateImageRef(item.fullDataUrl, `Ảnh xem lớn #${idx + 1}`, MAX_ASSET_PHOTO_CHARS);
  });
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// --- VERSION / UPDATE CONFIG ---
// APP_VERSION/GIT_SHA/BUILD_TIME are baked into the image at build time (see Dockerfile + CI).
const APP_VERSION = process.env.APP_VERSION || "dev";
const GIT_SHA = process.env.GIT_SHA || "";
const BUILD_TIME = process.env.BUILD_TIME || "";
// GitHub repo used to check whether a newer commit exists on the default branch.
const GITHUB_REPO = process.env.GITHUB_REPO || "happysmartlight/Family-Organizer";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
// Optional Watchtower HTTP API for one-click in-app updates.
const WATCHTOWER_URL = process.env.WATCHTOWER_URL || "";
const WATCHTOWER_TOKEN = process.env.WATCHTOWER_HTTP_API_TOKEN || "";

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

// Serve uploaded media (avatars/assets/receipts) as static files. Filenames are
// random/unguessable; the app runs on a private LAN/Tailscale network. Mounted
// before the SPA catch-all so image URLs resolve in both dev and production.
app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d", immutable: true, fallthrough: false }));

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

// --- MEDIA UPLOAD ---
// Accepts an optimized base64 data URL, writes it to disk under the given
// category folder, and returns the "/uploads/..." URL to store in the DB.
const UPLOAD_CATEGORIES = new Set(["avatars", "assets", "receipts"]);

app.post("/api/uploads", requireAuth, (req: AuthRequest, res: Response) => {
  const { dataUrl, category, subfolder } = req.body || {};
  if (!UPLOAD_CATEGORIES.has(category)) {
    res.status(400).json({ error: "Loại ảnh tải lên không hợp lệ." });
    return;
  }
  try {
    const saved = saveDataUrlToFile(dataUrl, category, subfolder);
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Tải ảnh lên thất bại." });
  }
});

// --- VERSION & SELF-UPDATE ---

app.get("/api/version", requireAuth, (_req: AuthRequest, res: Response) => {
  res.json({
    version: APP_VERSION,
    commit: GIT_SHA,
    shortCommit: GIT_SHA ? GIT_SHA.slice(0, 7) : "",
    buildTime: BUILD_TIME,
    canAutoUpdate: Boolean(WATCHTOWER_URL && WATCHTOWER_TOKEN)
  });
});

// Compare the running build's commit against the latest commit on the GitHub branch.
app.get("/api/version/check", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "family-organizer" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const ghRes = await fetch(url, { headers });
    if (!ghRes.ok) throw new Error(`GitHub trả về mã ${ghRes.status}`);
    const data: any = await ghRes.json();
    const latestSha: string = data.sha || "";
    const message: string = (data.commit?.message || "").split("\n")[0];
    const date: string = data.commit?.committer?.date || data.commit?.author?.date || "";
    res.json({
      currentCommit: GIT_SHA ? GIT_SHA.slice(0, 7) : "",
      latestCommit: latestSha ? latestSha.slice(0, 7) : "",
      // null = can't tell (running an un-versioned local/dev build)
      updateAvailable: GIT_SHA ? (Boolean(latestSha) && latestSha !== GIT_SHA) : null,
      latestMessage: message,
      latestDate: date,
      canAutoUpdate: Boolean(WATCHTOWER_URL && WATCHTOWER_TOKEN)
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || "Không kiểm tra được cập nhật." });
  }
});

// Trigger Watchtower to pull the newest image and restart the app (admin only).
app.post("/api/update", requireAuth, requireRole([UserRole.ADMIN]), async (_req: AuthRequest, res: Response) => {
  if (!WATCHTOWER_URL || !WATCHTOWER_TOKEN) {
    res.status(400).json({ error: "Chưa cấu hình Watchtower trên máy chủ (WATCHTOWER_URL / WATCHTOWER_HTTP_API_TOKEN)." });
    return;
  }
  try {
    const ghRes = await fetch(`${WATCHTOWER_URL.replace(/\/$/, "")}/v1/update`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WATCHTOWER_TOKEN}` }
    });
    if (!ghRes.ok) throw new Error(`Watchtower trả về mã ${ghRes.status}`);
    res.json({ success: true, message: "Đã yêu cầu cập nhật. Ứng dụng sẽ tải bản mới và khởi động lại trong giây lát." });
  } catch (err: any) {
    res.status(502).json({ error: err.message || "Không kích hoạt được cập nhật tự động." });
  }
});

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
  
  // Guard write permissions - Child/Guest can only edit tasks they created or are assigned to.
  if (isLimitedViewer(session.role) && req.body.id && !req.body.comments) {
    const existing = FamilyDB.getTasks().find(t => t.id === req.body.id);
    if (existing && existing.creatorId !== session.userId && existing.assigneeId !== session.userId) {
      res.status(403).json({ error: "Bạn chỉ được sửa đổi công việc do mình tạo hoặc được giao!" });
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

app.post("/api/plans", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER, UserRole.CHILD]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const planData = req.body;

  if (planData.id) {
    const existing = FamilyDB.getPlans().find(p => p.id === planData.id);
    if (existing && existing.creatorId !== session.userId && session.role !== UserRole.ADMIN) {
      res.status(403).json({ error: "Bạn chỉ có thể chỉnh sửa sự kiện do mình tạo. Admin có toàn quyền chỉnh sửa lịch." });
      return;
    }
  }

  try {
    const savedPlan = FamilyDB.savePlan(planData, session.userId, session.username);
    broadcastSyncEvent("PLANS_UPDATE", { planId: savedPlan.id });
    res.json({ plan: savedPlan });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/plans/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER, UserRole.CHILD]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;
  const existing = FamilyDB.getPlans().find(p => p.id === id);

  if (existing && existing.creatorId !== session.userId && session.role !== UserRole.ADMIN) {
    res.status(403).json({ error: "Bạn chỉ có thể xóa sự kiện do mình tạo. Admin có toàn quyền quản lý lịch." });
    return;
  }

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

app.get("/api/finance/assets", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  res.json({ assets: FamilyDB.getAssets() });
});

app.post("/api/finance/assets", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const assetData = req.body;

  try {
    validateAssetPhotosPayload(assetData.photos);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (assetData.id) {
    const existing = FamilyDB.getAssets().find(a => a.id === assetData.id);
    if (existing && existing.createdById !== session.userId && session.role !== UserRole.ADMIN) {
      res.status(403).json({ error: "Bạn chỉ có thể chỉnh sửa tài sản do mình tạo. Admin có toàn quyền quản lý tài sản." });
      return;
    }
  }

  try {
    const asset = FamilyDB.saveAsset(assetData, session.userId, session.username);
    broadcastSyncEvent("FINANCE_UPDATE", { assetId: asset.id });
    res.json({ asset });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/finance/assets/:id", requireAuth, requireRole([UserRole.ADMIN, UserRole.MEMBER]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const existing = FamilyDB.getAssets().find(a => a.id === req.params.id);

  if (existing && existing.createdById !== session.userId && session.role !== UserRole.ADMIN) {
    res.status(403).json({ error: "Bạn chỉ có thể xóa tài sản do mình tạo. Admin có toàn quyền quản lý tài sản." });
    return;
  }

  try {
    FamilyDB.deleteAsset(req.params.id, session.userId, session.username);
    broadcastSyncEvent("FINANCE_UPDATE", { deletedAssetId: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- MARKET PRICES API ---

interface MarketPriceCacheData {
  gold: { pricePerGramUsd: number; pricePerGramVnd: number; source: string } | null;
  crypto: Record<string, { usd: number; vnd: number }>;
  usdVndRate: number;
  lastUpdated: string;
  cacheUntil: number;
}

// CoinGecko ID map for common crypto symbols
const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", USDC: "usd-coin",
  BNB: "binancecoin", SOL: "solana", XRP: "ripple", ADA: "cardano",
  DOGE: "dogecoin", TON: "the-open-network", TRX: "tron", LINK: "chainlink",
  MATIC: "matic-network", DOT: "polkadot", AVAX: "avalanche-2", LTC: "litecoin",
  SHIB: "shiba-inu", UNI: "uniswap", ATOM: "cosmos", NEAR: "near",
  OP: "optimism", ARB: "arbitrum", SUI: "sui", PEPE: "pepe",
  FIL: "filecoin", APT: "aptos", INJ: "injective-protocol", SEI: "sei-network",
  STX: "blockstack", RENDER: "render-token", WIF: "dogwifcoin"
};

// Cache for extended crypto list (30+ coins). Gold + FX are reused from the
// dashboard's cachedFetch("gold") / cachedFetch("fx") — same vang.today source.
let _cryptoCache: { data: Record<string, { usd: number; vnd: number }>; until: number } = {
  data: {}, until: 0
};

async function fetchExtendedCrypto(): Promise<Record<string, { usd: number; vnd: number }>> {
  const now = Date.now();
  if (now < _cryptoCache.until) return _cryptoCache.data;

  try {
    const ids = Object.values(CRYPTO_ID_MAP).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,vnd`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (res.ok) {
      const raw = await res.json() as any;
      const result: Record<string, { usd: number; vnd: number }> = {};
      for (const [symbol, id] of Object.entries(CRYPTO_ID_MAP)) {
        if (raw[id]) {
          const usdPrice = raw[id].usd ?? 0;
          result[symbol] = { usd: usdPrice, vnd: raw[id].vnd ?? usdPrice * 25000 };
        }
      }
      _cryptoCache = { data: result, until: now + 5 * 60 * 1000 };
      return result;
    }
  } catch (err) {
    console.warn("[market-prices] crypto fetch failed:", (err as Error).message);
  }
  // On error keep stale data, retry in 1 min
  _cryptoCache.until = now + 60 * 1000;
  return _cryptoCache.data;
}

app.get("/api/market-prices", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    // Reuse the same cached data as the dashboard (vang.today for SJC gold, open.er-api for FX).
    // cachedFetch / fetchGold / fetchFx are async function declarations — hoisted, safe to call here.
    const [fx, goldRaw, cryptoData] = await Promise.all([
      cachedFetch("fx", 30 * 60 * 1000, fetchFx),
      cachedFetch("gold", 30 * 60 * 1000, () => fetchGold(null)),
      fetchExtendedCrypto()
    ]);

    const usdVndRate: number = fx?.usdVnd ?? 25000;

    // Convert SJC/vang.today gold result into per-unit prices the Assets module needs.
    // goldRaw.sell   = SJC VND/lượng (primary path)
    // goldRaw.vndPerTael = estimated VND/lượng from world price (fallback path)
    // goldRaw.usdPerOz   = world price in USD/troy oz (fallback path, no VND available)
    let gold: { pricePerGramUsd: number; pricePerGramVnd: number; source: string } | null = null;
    if (goldRaw) {
      const pricePerLuongVnd: number | null =
        goldRaw.sell ?? goldRaw.vndPerTael ??
        (goldRaw.usdPerOz ? Math.round((goldRaw.usdPerOz / 31.1035) * 37.5 * usdVndRate) : null);
      if (pricePerLuongVnd && pricePerLuongVnd > 0) {
        const pricePerLuongUsd = pricePerLuongVnd / usdVndRate;
        gold = {
          pricePerGramVnd: pricePerLuongVnd / 37.5,
          pricePerGramUsd: pricePerLuongUsd / 37.5,
          source: goldRaw.source ?? "vang.today"
        };
      }
    }

    res.json({
      gold: gold ? {
        pricePerGramUsd: gold.pricePerGramUsd,
        pricePerGramVnd: gold.pricePerGramVnd,
        pricePerChiUsd: gold.pricePerGramUsd * 3.75,
        pricePerChiVnd: gold.pricePerGramVnd * 3.75,
        pricePerLuongUsd: gold.pricePerGramUsd * 37.5,
        pricePerLuongVnd: gold.pricePerGramVnd * 37.5,
        source: gold.source
      } : null,
      crypto: cryptoData,
      usdVndRate,
      lastUpdated: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: "Không thể lấy giá thị trường." });
  }
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

function cleanAssistantText(value: any, maxLength: number): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function parseAssistantJson(rawText: string): any | null {
  const text = rawText.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeAssistantActions(actions: any[]): any[] {
  if (!Array.isArray(actions)) return [];

  return actions
    .map((action, actionIndex) => {
      if (!action || action.type !== "create_shopping_items") return null;
      const rawItems = Array.isArray(action.items) ? action.items : [];
      const seen = new Set<string>();
      const items = rawItems
        .map((item: any) => {
          const name = cleanAssistantText(typeof item === "string" ? item : item?.name, 80);
          if (!name) return null;
          const key = name.toLowerCase();
          if (seen.has(key)) return null;
          seen.add(key);
          return {
            name,
            quantity: cleanAssistantText(item?.quantity, 40),
            note: cleanAssistantText(item?.note, 120)
          };
        })
        .filter(Boolean)
        .slice(0, 20);

      if (items.length === 0) return null;
      return {
        id: `assistant_action_${Date.now()}_${actionIndex}_${Math.random().toString(36).slice(2, 6)}`,
        type: "create_shopping_items",
        title: cleanAssistantText(action.title, 100) || "Thêm nguyên liệu vào danh sách đi chợ",
        items
      };
    })
    .filter(Boolean);
}

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
    const tasks = FamilyDB.getTasks().slice(-30).map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      assigneeId: t.assigneeId,
      rewardPoints: t.rewardPoints
    }));
    const plans = FamilyDB.getPlans().slice(-30).map(p => ({
      id: p.id,
      title: p.title,
      startDate: p.startDate,
      endDate: p.endDate,
      isShared: p.isShared
    }));
    const transactions = FamilyDB.getTransactions().slice(-30).map(({ receiptImage, ...tx }) => tx);
    const medications = FamilyDB.getMedications().map(m => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      patientId: m.patientId,
      times: m.times,
      isActive: m.isActive
    }));
    const shoppingItems = FamilyDB.getShoppingItems()
      .filter(item => !item.isPurchased)
      .slice(0, 80)
      .map(item => ({ name: item.name, quantity: item.quantity, note: item.note }));
    const prompt = [
      "Bạn là trợ lý gia đình trong app Family Organizer. Trả lời ngắn gọn bằng tiếng Việt, ưu tiên việc có thể làm ngay.",
      "Bạn PHẢI trả về duy nhất một JSON object hợp lệ, không bọc markdown, không thêm chữ ngoài JSON.",
      "Schema: {\"reply\":\"câu trả lời cho người dùng\",\"actions\":[{\"type\":\"create_shopping_items\",\"title\":\"tiêu đề hành động\",\"items\":[{\"name\":\"tên món cần mua\",\"quantity\":\"số lượng nếu biết\",\"note\":\"ghi chú nếu cần\"}]}]}",
      "Chỉ tạo action create_shopping_items khi người dùng yêu cầu thêm/tạo/lập danh sách đi chợ, mua sắm, hoặc hỏi menu và nhờ thêm nguyên liệu vào danh sách đi chợ. Nếu chỉ hỏi gợi ý hoặc hỏi thông tin, actions phải là [].",
      "Không tạo quá 20 món. Gộp món trùng nhau. Không tự ý tạo task, giao dịch, thuốc hoặc lịch vì app hiện chỉ cho phép action đi chợ.",
      `Nguoi hoi: ${req.userSession?.fullName}`,
      `Tasks gan day: ${JSON.stringify(tasks)}`,
      `Lich gan day: ${JSON.stringify(plans)}`,
      `Giao dich gan day: ${JSON.stringify(transactions)}`,
      `Lich thuoc: ${JSON.stringify(medications)}`,
      `Danh sach di cho hien tai: ${JSON.stringify(shoppingItems)}`,
      `Cau hoi: ${message}`
    ].join("\n\n");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    } as any);
    const rawText = response.text || "";
    const parsed = parseAssistantJson(rawText);
    if (!parsed) {
      res.json({ answer: rawText || "Mình chưa có câu trả lời phù hợp.", actions: [] });
      return;
    }
    res.json({
      answer: cleanAssistantText(parsed.reply, 4000) || "Mình đã chuẩn bị gợi ý cho bạn.",
      actions: normalizeAssistantActions(parsed.actions)
    });
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
  const { username, fullName, role, passwordPlain, avatarColor, dateOfBirth, phone, familyRelation } = req.body;

  if (!username || !fullName || !role || !passwordPlain) {
    res.status(400).json({ error: "Vui lòng nhập đầy đủ chi tiết thành viên mới!" });
    return;
  }
  if (!VALID_ROLES.has(role)) {
    res.status(400).json({ error: "Vai trò (phân quyền) không hợp lệ!" });
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
      phone,
      familyRelation
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
    validateAvatarImagePayload(avatarImage);
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

app.post("/api/users/:id", requireAuth, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
  const session = req.userSession!;
  const { id } = req.params;
  const { fullName, role, dateOfBirth, phone, avatarColor, familyRelation } = req.body;

  if (role !== undefined && !VALID_ROLES.has(role)) {
    res.status(400).json({ error: "Vai trò (phân quyền) không hợp lệ!" });
    return;
  }

  try {
    const updated = FamilyDB.adminUpdateUser(id, { fullName, role, dateOfBirth, phone, avatarColor, familyRelation }, session.userId, session.username);
    broadcastSyncEvent("USERS_UPDATE", { updatedId: id });
    res.json({ user: updated });
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

// --- WEB PUSH (system notifications + app-icon badge) ---

// Public: the client needs the VAPID public key to create a push subscription.
app.get("/api/push/vapid-public-key", (_req: Request, res: Response) => {
  res.json({ publicKey: getVapidPublicKey(), enabled: isPushConfigured() });
});

// Save (upsert) this device's push subscription for the logged-in user.
app.post("/api/push/subscribe", requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userSession!.userId;
  const { subscription } = req.body || {};
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    res.status(400).json({ error: "Dữ liệu đăng ký thông báo không hợp lệ." });
    return;
  }
  try {
    FamilyDB.addPushSubscription(userId, subscription, req.headers["user-agent"]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Lưu đăng ký thất bại." });
  }
});

// Forget this device's subscription (called when the user turns notifications off).
app.post("/api/push/unsubscribe", requireAuth, (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint === "string" && endpoint) {
    FamilyDB.removePushSubscriptionByEndpoint(endpoint);
  }
  res.json({ success: true });
});

// Send a one-off test notification to the current user's devices.
app.post("/api/push/test", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userSession!.userId;
  if (!isPushConfigured()) {
    res.status(503).json({ error: "Máy chủ chưa cấu hình thông báo đẩy (VAPID)." });
    return;
  }
  try {
    const sent = await sendTestPush(
      FamilyDB.getPushSubscriptions(),
      userId,
      (dead) => FamilyDB.removePushSubscriptionsByEndpoints(dead)
    );
    res.json({ sent });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gửi thông báo thử thất bại." });
  }
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
    const pwaAssets: Record<string, { file: string; type: string; cacheControl: string }> = {
      "/manifest.webmanifest": {
        file: "manifest.webmanifest",
        type: "application/manifest+json",
        cacheControl: "no-cache"
      },
      "/sw.js": {
        file: "sw.js",
        type: "application/javascript; charset=utf-8",
        cacheControl: "no-cache, no-store, must-revalidate"
      },
      "/pwa-icon.svg": {
        file: "pwa-icon.svg",
        type: "image/svg+xml; charset=utf-8",
        cacheControl: "public, max-age=86400"
      }
    };

    Object.entries(pwaAssets).forEach(([route, asset]) => {
      app.get(route, (_req, res) => {
        res.setHeader("Content-Type", asset.type);
        res.setHeader("Cache-Control", asset.cacheControl);
        res.sendFile(path.join(distPath, asset.file), err => {
          if (err && !res.headersSent) {
            res.status(404).send(`${asset.file} not found. Rebuild the Docker image with the public/ directory included.`);
          }
        });
      });
    });

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

  // Backup on startup if the most recent auto backup is missing or stale (>20h).
  // Guards against never backing up when the server restarts more often than every 24h.
  try {
    const lastAuto = FamilyDB.getBackups().find(b => b.type === "auto");
    const staleMs = 20 * 60 * 60 * 1000;
    if (!lastAuto || Date.now() - new Date(lastAuto.createdAt).getTime() > staleMs) {
      console.log("Tạo backup tự động lúc khởi động...");
      FamilyDB.createBackup("auto", "system", "Hệ thống");
    }
  } catch (e) {
    console.error("Lỗi backup khi khởi động:", e);
  }

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
