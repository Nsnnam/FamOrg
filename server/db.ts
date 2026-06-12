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

// Initial seed data
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
    },
    {
      id: "user_mother",
      username: "melan",
      fullName: "Mẹ Lan (Member)",
      role: UserRole.MEMBER,
      avatarColor: "bg-pink-500",
      passwordHash: hashPassword("melan123"),
      createdAt: new Date().toISOString()
    },
    {
      id: "user_father",
      username: "bohung",
      fullName: "Bố Hùng (Member)",
      role: UserRole.MEMBER,
      avatarColor: "bg-blue-500",
      passwordHash: hashPassword("bohung123"),
      createdAt: new Date().toISOString()
    },
    {
      id: "user_child",
      username: "bevy",
      fullName: "Bé Vy (Guest/Kid)",
      role: UserRole.GUEST,
      avatarColor: "bg-amber-500",
      passwordHash: hashPassword("bevy123"),
      createdAt: new Date().toISOString()
    }
  ];

  const notifications: Notification[] = [
    {
      id: "notif_1",
      userId: "all",
      title: "Chào mừng cả nhà!",
      content: "Hệ thống Family Organizer đã khởi động thành công. Bố mẹ và bé có thể bắt đầu lập kế hoạch tuần mới rồi!",
      type: "system",
      isRead: false,
      createdAt: new Date().toISOString()
    }
  ];

  const tasks: Task[] = [
    {
      id: "task_1",
      title: "Đi siêu thị mua đồ ăn tuần mới",
      description: "Mua thịt heo, thịt bò, rau cải xanh, sữa bột cho bé Vy và nước giặt xả.",
      status: "todo" as any,
      priority: "high" as any,
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10) + " 17:00",
      creatorId: "user_mother",
      assigneeId: "user_father",
      isShared: true,
      tags: ["Mua sắm", "Thực phẩm"],
      comments: [
        {
          id: "c_1",
          userId: "user_father",
          username: "bohung",
          content: "Để anh đi làm về ghé qua siêu thị Coopmart mua luôn nhé.",
          createdAt: new Date().toISOString()
        }
      ],
      history: [
        {
          id: "h_1",
          userId: "user_mother",
          username: "melan",
          action: "tạo task và gán cho Bố Hùng",
          createdAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "task_2",
      title: "Dọn dẹp phòng đồ chơi của bé Vy",
      description: "Nhắc nhở bé xếp gọn gàng gấu bông và lego vào tủ sau khi chơi xong.",
      status: "in_progress" as any,
      priority: "medium" as any,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + " 20:00",
      creatorId: "user_father",
      assigneeId: "user_child",
      isShared: true,
      tags: ["Nhà cửa", "Dạy con"],
      comments: [],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "task_3",
      title: "Làm slide báo cáo quý 2",
      description: "Công việc công ty, chuẩn bị số liệu kế toán.",
      status: "todo" as any,
      priority: "high" as any,
      dueDate: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10) + " 09:00",
      creatorId: "user_father",
      assigneeId: "user_father",
      isShared: false,
      tags: ["Công việc"],
      comments: [],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const plans: FamilyPlan[] = [
    {
      id: "plan_1",
      title: "Đưa cả nhà đi dã ngoại Công viên Yên Sở",
      description: "Chuẩn bị thảm trải, lều dã ngoại, hoa quả và bánh mì sandwich.",
      startDate: new Date(Date.now() + 86400000 * 1).toISOString().slice(0, 10) + " 08:30",
      endDate: new Date(Date.now() + 86400000 * 1).toISOString().slice(0, 10) + " 15:30",
      isRecurring: false,
      recurrenceType: "none",
      creatorId: "user_father",
      isShared: true,
      color: "emerald",
      createdAt: new Date().toISOString()
    },
    {
      id: "plan_2",
      title: "Họp đại gia đình cuối tháng",
      description: "Ăn cơm tối cùng ông bà nội.",
      startDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10) + " 18:00",
      endDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10) + " 21:00",
      isRecurring: true,
      recurrenceType: "monthly",
      creatorId: "user_mother",
      isShared: true,
      color: "sky",
      createdAt: new Date().toISOString()
    }
  ];

  const notes: Note[] = [
    {
      id: "note_1",
      title: "Mật mã Wifi gia đình & SĐT khẩn cấp",
      content: `### 📶 Mạng Wifi Gia Đình
- **Tên mạng (SSID):** \`Family_Home_5G\`
- **Mật khẩu:** \`khoevadephangngay2026\`

### 📞 Số Điện Thoại Quan Trọng
- **Ông bà nội:** 0912.xxx.xxx
- **Ông bà ngoại:** 0983.xxx.xxx
- **Bác sĩ gia đình (phòng khám nhi):** 0904.xxx.xxx
- **Kỹ thuật sửa điện nước:** 1900.xxxx
`,
      isPinned: true,
      creatorId: "user_admin",
      tags: ["Quan trọng", "Thông tin chung"],
      isShared: true,
      allowedRolesToEdit: [UserRole.ADMIN, UserRole.MEMBER],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "note_2",
      title: "Công thức nấu phở bò gia truyền",
      content: `### Nguyên liệu chuẩn bị (cho 4 người):
1. **Xương ống bò:** 1kg (ninh lấy nước dùng ngọt thơm)
2. **Thịt bò (Thăn/Nạm):** 500g
3. **Bánh phở ngon:** 1kg
4. **Gia vị:** Đại hồi, tiểu hồi, quế chi, thảo quả, hành tây nướng, gừng nướng.

### Cách nấu cụ thể:
1. Ninh xương ống ít nhất 6 tiếng. Nhớ hớt bọt thường xuyên để nước dùng được trong.
2. Nướng gừng, hành củ, rang thơm thảo mộc rồi bỏ vào túi vải thả vào nồi nước dùng ninh thêm 2 tiếng trước khi ăn.
3. Cho bánh phở ra bát, xếp thịt bò tái/chín lên, rắc hành hoa rồi chan nước dùng thật sôi.
`,
      isPinned: false,
      creatorId: "user_mother",
      tags: ["Món ngon", "Gia đình"],
      isShared: true,
      allowedRolesToEdit: [UserRole.ADMIN, UserRole.MEMBER],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const transactions: FinancialTransaction[] = [
    {
      id: "tx_1",
      type: "expense" as any,
      amount: 450000,
      category: "food",
      account: "bank" as any,
      description: "Thanh toán hóa đơn Coopmart mua thực phẩm tuần",
      date: new Date().toISOString().slice(0, 10),
      creatorId: "user_mother",
      createdAt: new Date().toISOString()
    },
    {
      id: "tx_2",
      type: "expense" as any,
      amount: 1200000,
      category: "utilities",
      account: "bank" as any,
      description: "Tiền điện sinh hoạt gia đình tháng 5/2026",
      date: new Date().toISOString().slice(0, 10),
      creatorId: "user_admin",
      createdAt: new Date().toISOString()
    },
    {
      id: "tx_3",
      type: "income" as any,
      amount: 25000000,
      category: "Lương tháng",
      account: "bank" as any,
      description: "Nhận chuyển khoản lương của bố Hùng",
      date: new Date().toISOString().slice(0, 10),
      creatorId: "user_father",
      createdAt: new Date().toISOString()
    },
    {
      id: "tx_4",
      type: "expense" as any,
      amount: 80000,
      category: "transport",
      account: "cash" as any,
      description: "Đổ xăng xe máy Wave của mẹ Lan",
      date: new Date().toISOString().slice(0, 10),
      creatorId: "user_mother",
      createdAt: new Date().toISOString()
    }
  ];

  return {
    users,
    tasks,
    plans,
    notes,
    transactions,
    notifications,
    activityLogs: [
      {
        id: "l_1",
        userId: "user_admin",
        username: "admin",
        action: "Hệ thống",
        details: "Cơ sở dữ liệu gia đình được kích hoạt với các tài khoản mẫu.",
        createdAt: new Date().toISOString()
      }
    ],
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
