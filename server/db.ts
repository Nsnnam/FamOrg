/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  FamilyOrganizerDB,
  User,
  UserRole,
  Task,
  FamilyPlan,
  Note,
  FinancialTransaction,
  RewardPointEntry,
  BudgetLimit,
  RecurringBill,
  MedicationReminder,
  ShoppingItem,
  Notification
} from "../src/types.js";
import { sqliteIsEmpty, sqliteLoad, sqliteSave, sqliteCheckpoint } from "./sqlite.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const SECRET_FILE = path.join(DATA_DIR, "session_secret.key");

// Legacy salt kept only to verify passwords hashed by the old scheme.
const LEGACY_SALT = "family_organizer_salt_2026";
const PBKDF2_ITERATIONS = 120000;

// Password hashing: per-user random salt, stored as "salt$hash".
export function hashPassword(password: string, salt?: string): string {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, useSalt, PBKDF2_ITERATIONS, 64, "sha512").toString("hex");
  return `${useSalt}$${hash}`;
}

// Verify a plaintext password against a stored hash (supports legacy format).
export function verifyPassword(password: string, stored: string): boolean {
  if (stored && stored.includes("$")) {
    const sepIndex = stored.indexOf("$");
    const salt = stored.slice(0, sepIndex);
    const hash = stored.slice(sepIndex + 1);
    const computed = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512").toString("hex");
    if (computed.length !== hash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  }
  // Legacy fallback: old global-salt, 1000-iteration scheme.
  const legacy = crypto.pbkdf2Sync(password, LEGACY_SALT, 1000, 64, "sha512").toString("hex");
  return legacy === stored;
}

// Stable per-install secret used to sign session tokens. Generated once.
export function getSessionSecret(): string {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (existing) return existing;
    }
  } catch (e) {
    console.error("Không đọc được session secret:", e);
  }
  const secret = crypto.randomBytes(48).toString("hex");
  try {
    fs.writeFileSync(SECRET_FILE, secret, "utf8");
  } catch (e) {
    console.error("Không ghi được session secret:", e);
  }
  return secret;
}

// Initial seed data — a blank database with only a single admin account.
// All demo members and sample content (tasks/plans/notes/transactions) were removed.
// At least one admin is required because the app has no public sign-up; the
// admin creates real members afterwards from the Settings screen.
const initialDBState = (): FamilyOrganizerDB => {
  const users = [
    {
      id: "user_admin",
      username: "admin",
      fullName: "Gia Trưởng (Admin)",
      role: UserRole.ADMIN,
      avatarColor: "bg-red-500",
      passwordHash: hashPassword("admin123"),
      createdAt: new Date().toISOString()
    }
  ];

  return {
    users,
    tasks: [],
    plans: [],
    notes: [],
    transactions: [],
    rewardLedger: [],
    budgets: [],
    recurringBills: [],
    medications: [],
    shoppingItems: [],
    notifications: [],
    activityLogs: [],
    backups: []
  };
};

// Ensure all collections exist even when loading an older db.json that predates a field.
function normalizeDB(db: any): FamilyOrganizerDB {
  db.users = db.users || [];
  db.tasks = db.tasks || [];
  db.plans = db.plans || [];
  db.notes = db.notes || [];
  db.transactions = db.transactions || [];
  db.rewardLedger = db.rewardLedger || [];
  db.budgets = db.budgets || [];
  db.recurringBills = db.recurringBills || [];
  db.medications = db.medications || [];
  db.shoppingItems = db.shoppingItems || [];
  db.notifications = db.notifications || [];
  db.activityLogs = db.activityLogs || [];
  db.backups = db.backups || [];
  db.tasks = db.tasks.map((task: any) => ({
    ...task,
    rewardPoints: Number(task.rewardPoints || 0),
    completedById: task.completedById ?? null,
    completedAt: task.completedAt ?? null,
    recurrenceType: task.recurrenceType || "none",
    recurrenceInterval: Number(task.recurrenceInterval || 1),
    sourceRecurringTaskId: task.sourceRecurringTaskId ?? null
  }));
  return db as FamilyOrganizerDB;
}

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// One-time storage bootstrap: if SQLite is empty, import the existing db.json
// (preserving ids so sessions/frontend keep working), otherwise seed a blank DB.
// The original db.json is left untouched as a pre-migration rollback snapshot.
(function bootstrapStorage() {
  try {
    if (!sqliteIsEmpty()) return;
    let seed: FamilyOrganizerDB;
    if (fs.existsSync(DB_FILE)) {
      try {
        seed = normalizeDB(JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
        console.log("Đã nhập dữ liệu từ db.json sang SQLite (family.db).");
      } catch (e) {
        console.error("db.json hỏng, khởi tạo CSDL trắng:", e);
        seed = initialDBState();
      }
    } else {
      seed = initialDBState();
    }
    sqliteSave(seed);
  } catch (e) {
    console.error("Lỗi bootstrap SQLite:", e);
  }
})();

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const d = new Date(String(value).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function formatLocalDateTime(date: Date, withTime = true): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  if (!withTime) return `${yyyy}-${mm}-${dd}`;
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function advanceDateString(value: string, recurrenceType: string, interval = 1, withTime = true): string | null {
  const d = parseLocalDateTime(value);
  if (!d || recurrenceType === "none") return null;
  const step = Math.max(1, Number(interval || 1));
  if (recurrenceType === "daily") d.setDate(d.getDate() + step);
  if (recurrenceType === "weekly") d.setDate(d.getDate() + step * 7);
  if (recurrenceType === "monthly") d.setMonth(d.getMonth() + step);
  if (recurrenceType === "yearly") d.setFullYear(d.getFullYear() + step);
  return formatLocalDateTime(d, withTime);
}

// Core DB operations helper
export class FamilyDB {
  private static readRaw(): FamilyOrganizerDB {
    return normalizeDB(sqliteLoad());
  }

  private static writeRaw(db: FamilyOrganizerDB): void {
    // better-sqlite3 is synchronous; the save runs in a single atomic WAL transaction.
    try {
      sqliteSave(db);
    } catch (e) {
      console.error("Lỗi ghi dữ liệu vào SQLite:", e);
    }
  }

  // Activity logs helper
  public static logActivity(userId: string, username: string, action: string, details: string) {
    const db = this.readRaw();
    db.activityLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      username,
      action,
      details,
      createdAt: new Date().toISOString()
    });
    // Cap logs at 300 to keep it lightweight on Raspberry Pi 5
    if (db.activityLogs.length > 300) {
      db.activityLogs = db.activityLogs.slice(0, 300);
    }
    this.writeRaw(db);
  }

  // Backup management
  public static createBackup(type: "auto" | "manual", userId: string, username: string): { filename: string; sizeKb: number } {
    const db = this.readRaw();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_${type}_${timestamp}.json`;
    const destPath = path.join(BACKUP_DIR, filename);

    try {
      // Snapshot the live SQLite data to a JSON file (human-readable, restore-friendly).
      sqliteCheckpoint();
      fs.writeFileSync(destPath, JSON.stringify(db, null, 2), "utf8");

      const stats = fs.statSync(destPath);
      const sizeKb = Math.ceil(stats.size / 1024);

      // Save backup reference in memory
      db.backups.unshift({
        id: `backup_${Date.now()}`,
        filename,
        createdAt: new Date().toISOString(),
        sizeKb,
        type
      });

      this.writeRaw(db);
      this.logActivity(userId, username, "Backup dữ liệu", `Đã tạo tệp sao lưu ${filename} thành công (${sizeKb} KB).`);
      return { filename, sizeKb };
    } catch (err) {
      console.error("Không thể tạo backup tệp:", err);
      throw new Error(`Sao lưu dữ liệu thất bại: ${err}`);
    }
  }

  public static deleteBackup(backupId: string, userId: string, username: string): void {
    const db = this.readRaw();
    const backupIndex = db.backups.findIndex(b => b.id === backupId);
    if (backupIndex === -1) return;

    const backup = db.backups[backupIndex];
    const filepath = path.join(BACKUP_DIR, backup.filename);

    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      db.backups.splice(backupIndex, 1);
      this.writeRaw(db);
      this.logActivity(userId, username, "Xử lý Backup", `Đã xóa tệp sao lưu ${backup.filename}.`);
    } catch (err) {
      console.error("Lỗi xóa file backup:", err);
      throw err;
    }
  }

  public static restoreBackup(backupId: string, userId: string, username: string): void {
    const db = this.readRaw();
    const backup = db.backups.find(b => b.id === backupId);
    if (!backup) throw new Error("Không tìm thấy tệp sao lưu này!");

    const filepath = path.join(BACKUP_DIR, backup.filename);
    if (!fs.existsSync(filepath)) throw new Error("Tệp sao lưu vật lý không tồn tại trên đĩa!");

    try {
      // Read backed up file content
      const fileData = fs.readFileSync(filepath, "utf8");
      const parsedData = JSON.parse(fileData);

      // Validate integrity at least check users & tasks
      if (!parsedData.users || !parsedData.tasks) {
        throw new Error("Tệp sao lưu không hợp lệ hoặc thiếu thông tin cốt lõi!");
      }

      // Load the snapshot back into SQLite (atomic replace)
      sqliteSave(normalizeDB(parsedData));

      // Re-log the activity to the newly loaded db!
      this.logActivity(userId, username, "Phục hồi hệ thống", `Đã phục hồi dữ liệu về điểm sao lưu: ${backup.filename}.`);
    } catch (err) {
      console.error("Lỗi phục hồi dữ liệu:", err);
      throw err;
    }
  }

  // Generic Getters
  public static getUsers() {
    return this.readRaw().users;
  }

  public static getTasks() {
    return this.readRaw().tasks;
  }

  public static getPlans() {
    return this.readRaw().plans;
  }

  public static getNotes() {
    return this.readRaw().notes;
  }

  public static getTransactions() {
    return this.readRaw().transactions;
  }

  public static getRewardLedger() {
    return this.readRaw().rewardLedger;
  }

  public static getBudgets() {
    return this.readRaw().budgets;
  }

  public static getRecurringBills() {
    return this.readRaw().recurringBills;
  }

  public static getMedications() {
    return this.readRaw().medications;
  }

  public static getNotifications() {
    return this.readRaw().notifications;
  }

  public static getActivityLogs() {
    return this.readRaw().activityLogs;
  }

  public static getBackups() {
    return this.readRaw().backups;
  }

  // MUTATIONS (each returns the modified db items or a success state)
  
  // Create User (Admin Only)
  public static createUser(u: { username: string; fullName: string; role: UserRole; passwordPlain: string; avatarColor: string; dateOfBirth?: string; phone?: string }, adminId: string, adminUser: string): User {
    const db = this.readRaw();
    if (db.users.some(existing => existing.username === u.username.toLowerCase())) {
      throw new Error("Tài khoản này đã tồn tại trong gia đình!");
    }

    const newUser = {
      id: `user_${Date.now()}`,
      username: u.username.toLowerCase().trim(),
      fullName: u.fullName.trim(),
      role: u.role,
      avatarColor: u.avatarColor || "bg-indigo-500",
      dateOfBirth: u.dateOfBirth || undefined,
      phone: u.phone ? u.phone.trim() : undefined,
      passwordHash: hashPassword(u.passwordPlain),
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    this.writeRaw(db);
    this.logActivity(adminId, adminUser, "Thêm thành viên", `Đã thêm thành viên mới: ${newUser.fullName} (${newUser.role}).`);

    // Return safe user without secret passwordHash
    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  }

  // Update own profile (self-service personalization)
  public static updateProfile(userId: string, data: { fullName?: string; dateOfBirth?: string; phone?: string; avatarImage?: string; avatarColor?: string }): User {
    const db = this.readRaw();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx === -1) {
      throw new Error("Không tìm thấy tài khoản người dùng!");
    }

    const user = db.users[idx];

    if (data.fullName !== undefined) {
      const trimmed = data.fullName.trim();
      if (!trimmed) throw new Error("Tên hiển thị không được để trống!");
      user.fullName = trimmed;
    }
    if (data.dateOfBirth !== undefined) {
      user.dateOfBirth = data.dateOfBirth || undefined;
    }
    if (data.phone !== undefined) {
      user.phone = data.phone.trim() || undefined;
    }
    if (data.avatarColor !== undefined && data.avatarColor) {
      user.avatarColor = data.avatarColor;
    }
    if (data.avatarImage !== undefined) {
      // Empty string clears the custom image and falls back to the color avatar
      user.avatarImage = data.avatarImage || undefined;
    }

    db.users[idx] = user;
    this.writeRaw(db);
    this.logActivity(userId, user.username, "Cập nhật hồ sơ", `Đã cập nhật thông tin cá nhân của ${user.fullName}.`);

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Generate in-app notifications for birthdays happening within the next 7 days.
  // Deduplicated per user per year so it is safe to call repeatedly.
  public static generateBirthdayNotifications(): void {
    const db = this.readRaw();
    const today = new Date();
    const year = today.getFullYear();
    const todayMidnight = new Date(year, today.getMonth(), today.getDate()).getTime();
    let modified = false;

    db.users.forEach(u => {
      if (!u.dateOfBirth) return;
      const dob = new Date(u.dateOfBirth);
      if (isNaN(dob.getTime())) return;

      const bday = new Date(year, dob.getMonth(), dob.getDate()).getTime();
      const diffDays = Math.round((bday - todayMidnight) / 86400000);
      if (diffDays < 0 || diffDays > 7) return;

      const notifId = `notif_bday_${u.id}_${year}`;
      if (db.notifications.some(n => n.id === notifId)) return;

      const age = year - dob.getFullYear();
      const when = diffDays === 0 ? "hôm nay 🎉" : `trong ${diffDays} ngày nữa`;
      db.notifications.unshift({
        id: notifId,
        userId: "all",
        title: "🎂 Sắp đến sinh nhật!",
        content: `${u.fullName} sẽ tròn ${age} tuổi ${when} (ngày ${dob.getDate()}/${dob.getMonth() + 1}). Cả nhà chuẩn bị chúc mừng nhé!`,
        type: "system",
        isRead: false,
        createdAt: new Date().toISOString()
      });
      modified = true;
    });

    if (db.notifications.length > 200) {
      db.notifications = db.notifications.slice(0, 200);
    }
    if (modified) this.writeRaw(db);
  }

  // Delete User (Admin Only)
  public static deleteUser(userId: string, adminId: string, adminUser: string): void {
    const db = this.readRaw();
    const target = db.users.find(u => u.id === userId);
    if (!target) {
      throw new Error("Không tìm thấy thành viên này trong gia đình!");
    }
    if (userId === adminId) {
      throw new Error("Bạn không thể tự xóa tài khoản của chính mình!");
    }
    // Never allow removing the very last admin, or the system becomes unmanageable
    if (target.role === UserRole.ADMIN) {
      const adminCount = db.users.filter(u => u.role === UserRole.ADMIN).length;
      if (adminCount <= 1) {
        throw new Error("Không thể xóa Quản trị viên (Admin) cuối cùng của hệ thống!");
      }
    }

    db.users = db.users.filter(u => u.id !== userId);
    this.writeRaw(db);
    this.logActivity(adminId, adminUser, "Xóa thành viên", `Đã xóa tài khoản ${target.fullName} (@${target.username}).`);
  }

  // Change own password (requires current password)
  public static changePassword(userId: string, currentPassword: string, newPassword: string): void {
    const db = this.readRaw();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error("Không tìm thấy tài khoản!");
    if (!verifyPassword(currentPassword, db.users[idx].passwordHash)) {
      throw new Error("Mật khẩu hiện tại không chính xác!");
    }
    if (!newPassword || newPassword.length < 4) {
      throw new Error("Mật khẩu mới phải có ít nhất 4 ký tự!");
    }
    db.users[idx].passwordHash = hashPassword(newPassword);
    this.writeRaw(db);
    this.logActivity(userId, db.users[idx].username, "Đổi mật khẩu", "Đã đổi mật khẩu đăng nhập của mình.");
  }

  // Admin updates another member's profile + role
  public static adminUpdateUser(
    targetId: string,
    data: { fullName?: string; role?: UserRole; dateOfBirth?: string; phone?: string; avatarColor?: string },
    adminId: string,
    adminUser: string
  ): User {
    const db = this.readRaw();
    const idx = db.users.findIndex(u => u.id === targetId);
    if (idx === -1) throw new Error("Không tìm thấy thành viên!");
    const user = db.users[idx];

    // Never demote the very last admin (would lock everyone out of management)
    if (data.role !== undefined && data.role !== UserRole.ADMIN && user.role === UserRole.ADMIN) {
      const adminCount = db.users.filter(u => u.role === UserRole.ADMIN).length;
      if (adminCount <= 1) {
        throw new Error("Không thể đổi vai trò của Quản trị viên (Admin) cuối cùng!");
      }
    }

    if (data.fullName !== undefined) {
      const trimmed = data.fullName.trim();
      if (!trimmed) throw new Error("Tên hiển thị không được để trống!");
      user.fullName = trimmed;
    }
    if (data.role !== undefined) user.role = data.role;
    if (data.dateOfBirth !== undefined) user.dateOfBirth = data.dateOfBirth || undefined;
    if (data.phone !== undefined) user.phone = data.phone.trim() || undefined;
    if (data.avatarColor !== undefined && data.avatarColor) user.avatarColor = data.avatarColor;

    db.users[idx] = user;
    this.writeRaw(db);
    this.logActivity(adminId, adminUser, "Cập nhật thành viên", `Đã cập nhật ${user.fullName} (@${user.username}) — vai trò: ${user.role}.`);

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Admin resets another member's password (no current password needed)
  public static adminResetPassword(targetId: string, newPassword: string, adminId: string, adminUser: string): void {
    const db = this.readRaw();
    const idx = db.users.findIndex(u => u.id === targetId);
    if (idx === -1) throw new Error("Không tìm thấy thành viên!");
    if (!newPassword || newPassword.length < 4) {
      throw new Error("Mật khẩu mới phải có ít nhất 4 ký tự!");
    }
    db.users[idx].passwordHash = hashPassword(newPassword);
    this.writeRaw(db);
    this.logActivity(adminId, adminUser, "Đặt lại mật khẩu", `Đã đặt lại mật khẩu cho ${db.users[idx].fullName} (@${db.users[idx].username}).`);
  }

  // Tasks Management
  public static saveTask(taskData: Partial<Task>, userId: string, username: string): Task {
    const db = this.readRaw();
    const nowStr = new Date().toISOString();

    if (taskData.id) {
      // UPDATE Task
      const idx = db.tasks.findIndex(t => t.id === taskData.id);
      if (idx === -1) throw new Error("Task không tồn tại");

      const oldTask = db.tasks[idx];
      const isCompleting = taskData.status === "completed" && oldTask.status !== "completed";
      
      // Determine history changes
      const changelog: string[] = [];
      if (taskData.status && taskData.status !== oldTask.status) {
        changelog.push(`trạng thái từ '${oldTask.status}' thành '${taskData.status}'`);
      }
      if (taskData.assigneeId !== undefined && taskData.assigneeId !== oldTask.assigneeId) {
        const uStore = db.users.find(u => u.id === taskData.assigneeId);
        changelog.push(`giao việc cho ${uStore ? uStore.fullName : "Chưa phân công"}`);
      }

      const updatedHistory = [...(oldTask.history || [])];
      if (changelog.length > 0) {
        updatedHistory.unshift({
          id: `h_${Date.now()}`,
          userId,
          username,
          action: `Đã thay đổi: ${changelog.join(", ")}`,
          createdAt: nowStr
        });
      }

      const updatedTask: Task = {
        ...oldTask,
        ...taskData,
        rewardPoints: Math.max(0, Number((taskData as any).rewardPoints ?? oldTask.rewardPoints ?? 0)),
        recurrenceType: (taskData as any).recurrenceType ?? oldTask.recurrenceType ?? "none",
        recurrenceInterval: Math.max(1, Number((taskData as any).recurrenceInterval ?? oldTask.recurrenceInterval ?? 1)),
        recurrenceEndDate: (taskData as any).recurrenceEndDate ?? oldTask.recurrenceEndDate,
        sourceRecurringTaskId: (taskData as any).sourceRecurringTaskId ?? oldTask.sourceRecurringTaskId ?? null,
        completedById: isCompleting ? userId : (taskData.completedById ?? oldTask.completedById ?? null),
        completedAt: isCompleting ? nowStr : (taskData.completedAt ?? oldTask.completedAt ?? null),
        comments: taskData.comments || oldTask.comments || [],
        history: updatedHistory,
        updatedAt: nowStr
      } as Task;

      db.tasks[idx] = updatedTask;

      if (isCompleting && updatedTask.rewardPoints && updatedTask.rewardPoints > 0) {
        const awardUserId = updatedTask.assigneeId || userId;
        const awardUser = db.users.find(u => u.id === awardUserId);
        const alreadyAwarded = db.rewardLedger.some(e => e.taskId === updatedTask.id && e.userId === awardUserId);
        if (awardUser?.role === UserRole.GUEST && !alreadyAwarded) {
          db.rewardLedger.unshift({
            id: `reward_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: awardUserId,
            taskId: updatedTask.id,
            points: updatedTask.rewardPoints,
            reason: `Hoan thanh: ${updatedTask.title}`,
            createdById: userId,
            createdAt: nowStr
          });
          this.addNotificationInternal(db, awardUserId, "Diem thuong moi", `Con vua nhan ${updatedTask.rewardPoints} diem vi hoan thanh "${updatedTask.title}".`);
        }
      }

      if (isCompleting && updatedTask.recurrenceType && updatedTask.recurrenceType !== "none") {
        const nextDueDate = advanceDateString(updatedTask.dueDate, updatedTask.recurrenceType, updatedTask.recurrenceInterval || 1);
        const recurrenceEnd = updatedTask.recurrenceEndDate ? parseLocalDateTime(`${updatedTask.recurrenceEndDate} 23:59`) : null;
        const nextDue = nextDueDate ? parseLocalDateTime(nextDueDate) : null;
        const rootId = updatedTask.sourceRecurringTaskId || updatedTask.id;
        const alreadyGenerated = nextDueDate && db.tasks.some(t =>
          (t.sourceRecurringTaskId === rootId || t.id === rootId) &&
          t.dueDate === nextDueDate &&
          t.status !== "completed"
        );

        if (nextDueDate && nextDue && (!recurrenceEnd || nextDue.getTime() <= recurrenceEnd.getTime()) && !alreadyGenerated) {
          const nextTask: Task = {
            ...updatedTask,
            id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            status: "todo" as any,
            dueDate: nextDueDate,
            sourceRecurringTaskId: rootId,
            completedById: null,
            completedAt: null,
            comments: [],
            history: [{
              id: `h_${Date.now()}_next`,
              userId,
              username,
              action: "Tu tao tu task lap lai",
              createdAt: nowStr
            }],
            createdAt: nowStr,
            updatedAt: nowStr
          };
          db.tasks.push(nextTask);
        }
      }

      this.writeRaw(db);
      this.logActivity(userId, username, "Cập nhật Task", `Đã sửa đổi công việc "${updatedTask.title}".`);
      return updatedTask;
    } else {
      // CREATE Task
      const newTask: Task = {
        id: `task_${Date.now()}`,
        title: taskData.title || "Công việc mới",
        description: taskData.description || "",
        status: taskData.status || ("todo" as any),
        priority: taskData.priority || ("medium" as any),
        dueDate: taskData.dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10) + " 12:00",
        creatorId: userId,
        assigneeId: taskData.assigneeId || null,
        isShared: taskData.isShared !== undefined ? taskData.isShared : true,
        tags: taskData.tags || [],
        rewardPoints: Math.max(0, Number((taskData as any).rewardPoints || 0)),
        completedById: null,
        completedAt: null,
        recurrenceType: (taskData as any).recurrenceType || "none",
        recurrenceInterval: Math.max(1, Number((taskData as any).recurrenceInterval || 1)),
        recurrenceEndDate: (taskData as any).recurrenceEndDate || undefined,
        sourceRecurringTaskId: null,
        comments: [],
        history: [{
          id: `h_${Date.now()}`,
          userId,
          username,
          action: "Đã khởi tạo công việc này",
          createdAt: nowStr
        }],
        createdAt: nowStr,
        updatedAt: nowStr
      };

      db.tasks.push(newTask);
      this.logActivity(userId, username, "Tạo Task", `Đã lập công việc mới "${newTask.title}".`);

      // Push notification to assignee
      if (newTask.assigneeId && newTask.assigneeId !== userId) {
        this.addNotificationInternal(db, newTask.assigneeId, "Công việc mới được giao", `Bạn vừa được giao nhiệm vụ: "${newTask.title}"`);
      } else if (newTask.isShared) {
        this.addNotificationInternal(db, "all", "Công việc gia đình mới", `Cả nhà ơi có nhiệm vụ: "${newTask.title}"`);
      }

      this.writeRaw(db);
      this.logActivity(userId, username, "Tao Task", `Da lap cong viec moi "${newTask.title}".`);
      return newTask;
    }
  }

  public static addCommentToTask(taskId: string, commentContent: string, userId: string, username: string): Task {
    const db = this.readRaw();
    const idx = db.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error("Task không tồn tại");

    const task = db.tasks[idx];
    const newComment = {
      id: `c_${Date.now()}`,
      userId,
      username,
      content: commentContent,
      createdAt: new Date().toISOString()
    };

    task.comments.push(newComment);
    task.history.unshift({
      id: `h_${Date.now()}`,
      userId,
      username,
      action: `Đã bình luận: "${commentContent.substring(0, 30)}${commentContent.length > 30 ? "..." : ""}"`,
      createdAt: new Date().toISOString()
    });
    task.updatedAt = new Date().toISOString();

    db.tasks[idx] = task;
    this.writeRaw(db);
    this.logActivity(userId, username, "Bình luận Task", `Đã bình luận trong công việc "${task.title}".`);
    return task;
  }

  public static deleteTask(taskId: string, userId: string, username: string): void {
    const db = this.readRaw();
    const idx = db.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;

    const taskTitle = db.tasks[idx].title;
    db.tasks.splice(idx, 1);
    this.writeRaw(db);
    this.logActivity(userId, username, "Xóa Task", `Đã xóa công việc "${taskTitle}".`);
  }

  // Plans Management
  public static savePlan(planData: Partial<FamilyPlan>, userId: string, username: string): FamilyPlan {
    const db = this.readRaw();
    const nowStr = new Date().toISOString();

    if (planData.id) {
      // UPDATE
      const idx = db.plans.findIndex(p => p.id === planData.id);
      if (idx === -1) throw new Error("Kế hoạch không tồn tại");

      const updated = {
        ...db.plans[idx],
        ...planData
      } as FamilyPlan;

      db.plans[idx] = updated;
      this.writeRaw(db);
      this.logActivity(userId, username, "Cập nhật Lịch trình", `Đã cập nhật sự kiện "${updated.title}".`);
      return updated;
    } else {
      // CREATE
      const newPlan: FamilyPlan = {
        id: `plan_${Date.now()}`,
        title: planData.title || "Kế hoạch mới",
        description: planData.description || "",
        startDate: planData.startDate || new Date().toISOString().slice(0, 16).replace("T", " "),
        endDate: planData.endDate || new Date(Date.now() + 3600000).toISOString().slice(0, 16).replace("T", " "),
        isRecurring: planData.isRecurring || false,
        recurrenceType: planData.recurrenceType || "none",
        creatorId: userId,
        isShared: planData.isShared !== undefined ? planData.isShared : true,
        color: planData.color || "sky",
        createdAt: nowStr
      };

      db.plans.push(newPlan);
      this.writeRaw(db);
      this.logActivity(userId, username, "Tạo Lịch trình", `Đã lập lịch trình mới: "${newPlan.title}".`);

      if (newPlan.isShared) {
        this.addNotificationInternal(db, "all", "Sự kiện gia đình mới", `Lịch gia đình có sự kiện mới: "${newPlan.title}" vào ngày ${newPlan.startDate.substring(0, 10)}`);
      }

      return newPlan;
    }
  }

  public static deletePlan(planId: string, userId: string, username: string): void {
    const db = this.readRaw();
    const idx = db.plans.findIndex(p => p.id === planId);
    if (idx === -1) return;

    const title = db.plans[idx].title;
    db.plans.splice(idx, 1);
    this.writeRaw(db);
    this.logActivity(userId, username, "Xóa Lịch trình", `Đã xóa sự kiện "${title}".`);
  }

  // Notes Management
  public static saveNote(noteData: Partial<Note>, userId: string, username: string): Note {
    const db = this.readRaw();
    const nowStr = new Date().toISOString();

    if (noteData.id) {
      // UPDATE Note
      const idx = db.notes.findIndex(n => n.id === noteData.id);
      if (idx === -1) throw new Error("Ghi chú không tồn tại");

      const oldNote = db.notes[idx];
      
      const updatedNote: Note = {
        ...oldNote,
        ...noteData,
        updatedAt: nowStr
      } as Note;

      db.notes[idx] = updatedNote;
      this.writeRaw(db);
      this.logActivity(userId, username, "Cập nhật Ghi chú", `Đã chỉnh sửa ghi chú "${updatedNote.title}".`);
      return updatedNote;
    } else {
      // CREATE Note
      const newNote: Note = {
        id: `note_${Date.now()}`,
        title: noteData.title || "Ghi chú không tên",
        content: noteData.content || "",
        isPinned: noteData.isPinned || false,
        creatorId: userId,
        tags: noteData.tags || [],
        isShared: noteData.isShared !== undefined ? noteData.isShared : true,
        allowedRolesToEdit: noteData.allowedRolesToEdit || [UserRole.ADMIN, UserRole.MEMBER],
        createdAt: nowStr,
        updatedAt: nowStr
      };

      db.notes.push(newNote);
      this.writeRaw(db);
      this.logActivity(userId, username, "Tạo Ghi chú", `Đã tạo ghi chú "${newNote.title}".`);

      return newNote;
    }
  }

  public static deleteNote(noteId: string, userId: string, username: string): void {
    const db = this.readRaw();
    const idx = db.notes.findIndex(n => n.id === noteId);
    if (idx === -1) return;

    const title = db.notes[idx].title;
    db.notes.splice(idx, 1);
    this.writeRaw(db);
    this.logActivity(userId, username, "Xóa Ghi chú", `Đã xóa ghi chú "${title}".`);
  }

  // Financial transactions management
  public static saveTransaction(txData: Partial<FinancialTransaction>, userId: string, username: string): FinancialTransaction {
    const db = this.readRaw();

    const newTx: FinancialTransaction = {
      id: txData.id ? txData.id : `tx_${Date.now()}`,
      type: txData.type || ("expense" as any),
      amount: txData.amount || 0,
      category: txData.category || "other",
      account: txData.account || ("bank" as any),
      description: txData.description || "",
      date: txData.date || new Date().toISOString().slice(0, 10),
      creatorId: userId,
      receiptImage: txData.receiptImage, // Base64 supported
      createdAt: txData.createdAt || new Date().toISOString()
    };

    if (txData.id) {
      // UPDATE
      const idx = db.transactions.findIndex(t => t.id === txData.id);
      if (idx === -1) throw new Error("Giao dịch không tồn tại");
      db.transactions[idx] = newTx;
      this.logActivity(userId, username, "Sửa giao dịch tài chính", `Đã điều chỉnh giao dịch "${newTx.description}" (${newTx.amount.toLocaleString()} VNĐ)`);
    } else {
      // CREATE
      db.transactions.push(newTx);
      this.logActivity(userId, username, "Ghi chép tài chính", `Đã ghi lại ${newTx.type === "expense" ? "khoản chi" : "khoản thu"} "${newTx.description}" (${newTx.amount.toLocaleString()} VNĐ)`);
    }

    this.writeRaw(db);
    return newTx;
  }

  public static deleteTransaction(txId: string, userId: string, username: string): void {
    const db = this.readRaw();
    const idx = db.transactions.findIndex(t => t.id === txId);
    if (idx === -1) return;

    const tx = db.transactions[idx];
    db.transactions.splice(idx, 1);
    this.writeRaw(db);
    this.logActivity(userId, username, "Xóa giao dịch tài chính", `Đã xóa giao dịch "${tx.description}" (${tx.amount.toLocaleString()} VNĐ).`);
  }

  // --- REWARD POINTS ---
  public static addRewardEntry(data: Partial<RewardPointEntry>, userId: string, username: string): RewardPointEntry {
    const db = this.readRaw();
    const target = db.users.find(u => u.id === data.userId);
    if (!target) throw new Error("Khong tim thay thanh vien nhan diem");
    const points = Number(data.points || 0);
    if (!points) throw new Error("So diem khong hop le");

    const entry: RewardPointEntry = {
      id: `reward_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: target.id,
      taskId: data.taskId,
      points,
      reason: data.reason || "Dieu chinh diem",
      createdById: userId,
      createdAt: new Date().toISOString()
    };
    db.rewardLedger.unshift(entry);
    this.writeRaw(db);
    this.logActivity(userId, username, "Diem thuong", `Da cap nhat ${points} diem cho ${target.fullName}.`);
    return entry;
  }

  // --- BUDGETS + RECURRING BILLS ---
  public static saveBudget(data: Partial<BudgetLimit>, userId: string, username: string): BudgetLimit {
    const db = this.readRaw();
    const now = new Date().toISOString();
    if (!data.month || !data.category || !data.limit) throw new Error("Thieu thang, hang muc hoac han muc ngan sach");

    if (data.id) {
      const idx = db.budgets.findIndex(b => b.id === data.id);
      if (idx === -1) throw new Error("Khong tim thay ngan sach");
      const updated = { ...db.budgets[idx], ...data, limit: Number(data.limit), updatedAt: now } as BudgetLimit;
      db.budgets[idx] = updated;
      this.writeRaw(db);
      return updated;
    }

    const existingIdx = db.budgets.findIndex(b => b.month === data.month && b.category === data.category);
    const budget: BudgetLimit = {
      id: existingIdx >= 0 ? db.budgets[existingIdx].id : `budget_${Date.now()}`,
      month: data.month,
      category: data.category,
      limit: Number(data.limit),
      createdAt: existingIdx >= 0 ? db.budgets[existingIdx].createdAt : now,
      updatedAt: now
    };
    if (existingIdx >= 0) db.budgets[existingIdx] = budget;
    else db.budgets.unshift(budget);
    this.writeRaw(db);
    this.logActivity(userId, username, "Ngan sach", `Da dat ngan sach ${budget.category} thang ${budget.month}.`);
    return budget;
  }

  public static deleteBudget(id: string): void {
    const db = this.readRaw();
    db.budgets = db.budgets.filter(b => b.id !== id);
    this.writeRaw(db);
  }

  public static saveRecurringBill(data: Partial<RecurringBill>, userId: string, username: string): RecurringBill {
    const db = this.readRaw();
    const now = new Date().toISOString();
    if (!data.title || !data.amount || !data.nextDueDate) throw new Error("Thieu ten hoa don, so tien hoac ngay den han");

    if (data.id) {
      const idx = db.recurringBills.findIndex(b => b.id === data.id);
      if (idx === -1) throw new Error("Khong tim thay hoa don dinh ky");
      const updated = {
        ...db.recurringBills[idx],
        ...data,
        amount: Number(data.amount),
        updatedAt: now
      } as RecurringBill;
      db.recurringBills[idx] = updated;
      this.writeRaw(db);
      return updated;
    }

    const bill: RecurringBill = {
      id: `bill_${Date.now()}`,
      title: data.title.trim(),
      amount: Number(data.amount),
      category: data.category || "utilities",
      account: data.account || ("bank" as any),
      frequency: data.frequency || "monthly",
      nextDueDate: data.nextDueDate,
      notes: data.notes?.trim() || "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      lastPaidDate: data.lastPaidDate,
      createdAt: now,
      updatedAt: now
    };
    db.recurringBills.unshift(bill);
    this.writeRaw(db);
    this.logActivity(userId, username, "Hoa don dinh ky", `Da tao hoa don dinh ky "${bill.title}".`);
    return bill;
  }

  public static deleteRecurringBill(id: string): void {
    const db = this.readRaw();
    db.recurringBills = db.recurringBills.filter(b => b.id !== id);
    this.writeRaw(db);
  }

  public static payRecurringBill(id: string, userId: string, username: string): { bill: RecurringBill; transaction: FinancialTransaction } {
    const db = this.readRaw();
    const idx = db.recurringBills.findIndex(b => b.id === id);
    if (idx === -1) throw new Error("Khong tim thay hoa don dinh ky");
    const bill = db.recurringBills[idx];
    const paidDate = new Date().toISOString().slice(0, 10);
    const tx: FinancialTransaction = {
      id: `tx_${Date.now()}`,
      type: "expense" as any,
      amount: bill.amount,
      category: bill.category,
      account: bill.account,
      description: `Thanh toan hoa don: ${bill.title}`,
      date: paidDate,
      creatorId: userId,
      createdAt: new Date().toISOString()
    };
    db.transactions.push(tx);
    const nextDue = advanceDateString(`${bill.nextDueDate} 09:00`, bill.frequency, 1, false) || bill.nextDueDate;
    bill.lastPaidDate = paidDate;
    bill.nextDueDate = nextDue;
    bill.updatedAt = new Date().toISOString();
    db.recurringBills[idx] = bill;
    this.writeRaw(db);
    this.logActivity(userId, username, "Thanh toan hoa don", `Da thanh toan "${bill.title}" (${bill.amount.toLocaleString()} VND).`);
    return { bill, transaction: tx };
  }

  // --- SHOPPING LIST ---
  public static getShoppingItems() {
    return this.readRaw().shoppingItems;
  }

  public static saveShoppingItem(data: Partial<ShoppingItem>, userId: string, username: string): ShoppingItem {
    const db = this.readRaw();
    const now = new Date().toISOString();

    if (data.id) {
      const idx = db.shoppingItems.findIndex(i => i.id === data.id);
      if (idx === -1) throw new Error("Món đồ không tồn tại");
      const updated = { ...db.shoppingItems[idx], ...data, updatedAt: now } as ShoppingItem;
      db.shoppingItems[idx] = updated;
      this.writeRaw(db);
      return updated;
    }

    const newItem: ShoppingItem = {
      id: `shop_${Date.now()}`,
      name: (data.name || "Món đồ").trim(),
      quantity: data.quantity?.trim() || "",
      note: data.note?.trim() || "",
      isPurchased: false,
      creatorId: userId,
      purchasedById: null,
      createdAt: now,
      updatedAt: now
    };
    db.shoppingItems.unshift(newItem);
    this.writeRaw(db);
    this.logActivity(userId, username, "Thêm đồ đi chợ", `Đã thêm "${newItem.name}" vào danh sách mua sắm.`);
    return newItem;
  }

  public static toggleShoppingItem(id: string, userId: string): ShoppingItem {
    const db = this.readRaw();
    const idx = db.shoppingItems.findIndex(i => i.id === id);
    if (idx === -1) throw new Error("Món đồ không tồn tại");
    const item = db.shoppingItems[idx];
    item.isPurchased = !item.isPurchased;
    item.purchasedById = item.isPurchased ? userId : null;
    item.updatedAt = new Date().toISOString();
    this.writeRaw(db);
    return item;
  }

  public static deleteShoppingItem(id: string, userId: string, username: string): void {
    const db = this.readRaw();
    const idx = db.shoppingItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    const name = db.shoppingItems[idx].name;
    db.shoppingItems.splice(idx, 1);
    this.writeRaw(db);
    this.logActivity(userId, username, "Xóa đồ đi chợ", `Đã xóa "${name}" khỏi danh sách mua sắm.`);
  }

  public static clearPurchasedShopping(userId: string, username: string): number {
    const db = this.readRaw();
    const before = db.shoppingItems.length;
    db.shoppingItems = db.shoppingItems.filter(i => !i.isPurchased);
    const removed = before - db.shoppingItems.length;
    if (removed > 0) {
      this.writeRaw(db);
      this.logActivity(userId, username, "Dọn đồ đã mua", `Đã xóa ${removed} món đã mua khỏi danh sách đi chợ.`);
    }
    return removed;
  }

  // --- MEDICATION REMINDERS ---
  public static saveMedication(data: Partial<MedicationReminder>, userId: string, username: string): MedicationReminder {
    const db = this.readRaw();
    const now = new Date().toISOString();
    if (!data.name || !data.patientId || !data.times || data.times.length === 0) {
      throw new Error("Thieu ten thuoc, nguoi uong hoac gio nhac");
    }

    if (data.id) {
      const idx = db.medications.findIndex(m => m.id === data.id);
      if (idx === -1) throw new Error("Khong tim thay lich thuoc");
      const updated = { ...db.medications[idx], ...data, updatedAt: now } as MedicationReminder;
      db.medications[idx] = updated;
      this.writeRaw(db);
      return updated;
    }

    const med: MedicationReminder = {
      id: `med_${Date.now()}`,
      name: data.name.trim(),
      dosage: data.dosage?.trim() || "",
      patientId: data.patientId,
      times: data.times.map(t => t.trim()).filter(Boolean),
      startDate: data.startDate || new Date().toISOString().slice(0, 10),
      endDate: data.endDate || undefined,
      notes: data.notes?.trim() || "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      updatedAt: now
    };
    db.medications.unshift(med);
    this.writeRaw(db);
    this.logActivity(userId, username, "Nhac thuoc", `Da tao lich thuoc "${med.name}".`);
    return med;
  }

  public static deleteMedication(id: string): void {
    const db = this.readRaw();
    db.medications = db.medications.filter(m => m.id !== id);
    this.writeRaw(db);
  }

  // Pre-deadline reminders: notify before tasks are due and before plans start.
  // Deduplicated by notification id so each window fires only once.
  public static generateReminders(): void {
    const db = this.readRaw();
    const now = Date.now();
    let modified = false;

    const ensure = (id: string, userId: string, title: string, content: string, type: Notification["type"]) => {
      if (db.notifications.some(n => n.id === id)) return;
      db.notifications.unshift({ id, userId, title, content, type, isRead: false, createdAt: new Date().toISOString() });
      modified = true;
    };
    const parse = (s: string): number | null => {
      if (!s) return null;
      const d = new Date(String(s).replace(" ", "T"));
      return isNaN(d.getTime()) ? null : d.getTime();
    };

    db.tasks.forEach(t => {
      if (t.status === "completed") return;
      const due = parse(t.dueDate);
      if (due === null) return;
      const diffMin = (due - now) / 60000;
      const recipient = t.assigneeId || "all";
      if (diffMin > 60 && diffMin <= 24 * 60) {
        ensure(`notif_taskdue1d_${t.id}`, recipient, "⏰ Sắp đến hạn công việc", `"${t.title}" đến hạn lúc ${t.dueDate}.`, "task");
      } else if (diffMin > 0 && diffMin <= 60) {
        ensure(`notif_taskdue1h_${t.id}`, recipient, "⏰ Công việc sắp đến hạn!", `"${t.title}" sẽ đến hạn trong vòng 1 giờ (${t.dueDate}).`, "task");
      }
    });

    db.plans.forEach(p => {
      const start = parse(p.startDate);
      if (start === null) return;
      const diffMin = (start - now) / 60000;
      const recipient = p.isShared ? "all" : p.creatorId;
      if (diffMin > 60 && diffMin <= 24 * 60) {
        ensure(`notif_plansoon1d_${p.id}`, recipient, "📅 Sự kiện sắp diễn ra", `"${p.title}" bắt đầu lúc ${p.startDate}.`, "plan");
      } else if (diffMin > 0 && diffMin <= 60) {
        ensure(`notif_plansoon1h_${p.id}`, recipient, "📅 Sự kiện sắp bắt đầu!", `"${p.title}" sẽ bắt đầu trong vòng 1 giờ (${p.startDate}).`, "plan");
      }
    });

    db.recurringBills.forEach(b => {
      if (!b.isActive) return;
      const due = parse(`${b.nextDueDate} 09:00`);
      if (due === null) return;
      const diffMin = (due - now) / 60000;
      if (diffMin > 0 && diffMin <= 3 * 24 * 60) {
        ensure(`notif_billdue_${b.id}_${b.nextDueDate}`, "all", "Hoa don sap den han", `"${b.title}" den han ngay ${b.nextDueDate}, so tien ${b.amount.toLocaleString()} VND.`, "finance");
      }
    });

    const today = new Date();
    const todayKey = formatLocalDateTime(today, false);
    db.medications.forEach(m => {
      if (!m.isActive) return;
      if (m.startDate && todayKey < m.startDate) return;
      if (m.endDate && todayKey > m.endDate) return;
      const patient = db.users.find(u => u.id === m.patientId);
      m.times.forEach(time => {
        const reminderAt = parse(`${todayKey} ${time}`);
        if (reminderAt === null) return;
        const diffMin = (reminderAt - now) / 60000;
        if (diffMin > 0 && diffMin <= 60) {
          ensure(
            `notif_med_${m.id}_${todayKey}_${time.replace(":", "")}`,
            m.patientId || "all",
            "Den gio uong thuoc",
            `${patient?.fullName || "Thanh vien"} can uong ${m.name}${m.dosage ? ` (${m.dosage})` : ""} luc ${time}.`,
            "medication"
          );
        }
      });
    });

    if (db.notifications.length > 200) {
      db.notifications = db.notifications.slice(0, 200);
    }
    if (modified) this.writeRaw(db);
  }

  // Internal notification builder
  private static addNotificationInternal(db: FamilyOrganizerDB, userId: string, title: string, content: string) {
    const newNotif: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      title,
      content,
      type: "system",
      isRead: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.unshift(newNotif);
    // Keep max 200 notifications
    if (db.notifications.length > 200) {
      db.notifications = db.notifications.slice(0, 200);
    }
  }

  // Read notification status mark
  public static markNotificationRead(notifId: string, userId: string): void {
    const db = this.readRaw();
    const idx = db.notifications.findIndex(n => n.id === notifId);
    if (idx !== -1) {
      db.notifications[idx].isRead = true;
      this.writeRaw(db);
    }
  }

  public static markAllNotificationsRead(userId: string): void {
    const db = this.readRaw();
    let modified = false;
    db.notifications.forEach(n => {
      if ((n.userId === "all" || n.userId === userId) && !n.isRead) {
        n.isRead = true;
        modified = true;
      }
    });
    if (modified) {
      this.writeRaw(db);
    }
  }
}
