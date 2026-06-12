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
  Notification
} from "../src/types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

// Password hashing helper using standard Node PBKDF2
const SALT = "family_organizer_salt_2026";
export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 1000, 64, "sha512").toString("hex");
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
    notifications: [],
    activityLogs: [],
    backups: []
  };
};

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// In-memory lock to avoid write race conditions (mutex)
let isWriting = false;

// Core DB operations helper
export class FamilyDB {
  private static readRaw(): FamilyOrganizerDB {
    if (!fs.existsSync(DB_FILE)) {
      const defaultState = initialDBState();
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), "utf8");
      return defaultState;
    }
    try {
      const data = fs.readFileSync(DB_FILE, "utf8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Lỗi đọc DB file, tạo lại dựa trên file lỗi:", e);
      // Create backup of corrupted file before destroying
      try {
        const corruptedBackup = path.join(DATA_DIR, `db_corrupted_${Date.now()}.json`);
        if (fs.existsSync(DB_FILE)) {
          fs.copyFileSync(DB_FILE, corruptedBackup);
        }
      } catch (backupErr) {
        console.error("Không thể backup DB hỏng", backupErr);
      }
      const defaultState = initialDBState();
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), "utf8");
      return defaultState;
    }
  }

  private static writeRaw(db: FamilyOrganizerDB): void {
    if (isWriting) {
      // Small spin-lock wait/retry
      setTimeout(() => this.writeRaw(db), 10);
      return;
    }
    isWriting = true;
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), "utf8");
      fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
      console.error("Lỗi ghi dữ liệu DB:", e);
    } finally {
      isWriting = false;
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
      // Just copy the current live database file
      if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, destPath);
      } else {
        fs.writeFileSync(destPath, JSON.stringify(db, null, 2), "utf8");
      }

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

      // Overwrite current file
      fs.writeFileSync(DB_FILE, JSON.stringify(parsedData, null, 2), "utf8");

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
  public static createUser(u: { username: string; fullName: string; role: UserRole; passwordPlain: string; avatarColor: string }, adminId: string, adminUser: string): User {
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

  // Tasks Management
  public static saveTask(taskData: Partial<Task>, userId: string, username: string): Task {
    const db = this.readRaw();
    const nowStr = new Date().toISOString();

    if (taskData.id) {
      // UPDATE Task
      const idx = db.tasks.findIndex(t => t.id === taskData.id);
      if (idx === -1) throw new Error("Task không tồn tại");

      const oldTask = db.tasks[idx];
      
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
        comments: taskData.comments || oldTask.comments || [],
        history: updatedHistory,
        updatedAt: nowStr
      } as Task;

      db.tasks[idx] = updatedTask;
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
      this.writeRaw(db);
      this.logActivity(userId, username, "Tạo Task", `Đã lập công việc mới "${newTask.title}".`);

      // Push notification to assignee
      if (newTask.assigneeId && newTask.assigneeId !== userId) {
        this.addNotificationInternal(db, newTask.assigneeId, "Công việc mới được giao", `Bạn vừa được giao nhiệm vụ: "${newTask.title}"`);
      } else if (newTask.isShared) {
        this.addNotificationInternal(db, "all", "Công việc gia đình mới", `Cả nhà ơi có nhiệm vụ: "${newTask.title}"`);
      }

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
