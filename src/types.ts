/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User and Role management
export enum UserRole {
  ADMIN = "admin",
  MEMBER = "member",
  GUEST = "guest"
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  avatarColor: string; // Tailwind color name like 'bg-red-500'
  avatarImage?: string; // Optional custom avatar (base64 data-uri); falls back to avatarColor
  dateOfBirth?: string; // YYYY-MM-DD, used for birthday reminders
  phone?: string; // Optional contact phone number
  createdAt: string;
}

// Session info
export interface UserSession {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
}

// Notification system
export interface Notification {
  id: string;
  userId: string; // Recipient (or 'all' for everyone)
  title: string;
  content: string;
  type: "task" | "plan" | "note" | "finance" | "medication" | "system";
  isRead: boolean;
  createdAt: string;
}

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

// TasK management
export enum TaskStatus {
  TODO = "todo",          // Chưa làm
  IN_PROGRESS = "in_progress", // Đang làm
  COMPLETED = "completed",   // Hoàn thành
  OVERDUE = "overdue"      // Quá hạn
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high"
}

export interface TaskComment {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface TaskHistory {
  id: string;
  userId: string;
  username: string;
  action: string; // e.g. "updated target field status from todo to in_progress"
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD HH:mm
  creatorId: string;
  assigneeId: string | null; // Null means unassigned or shared
  isShared: boolean; // True means shared with everyone in family
  tags: string[];
  rewardPoints?: number;
  completedById?: string | null;
  completedAt?: string | null;
  recurrenceType?: RecurrenceType;
  recurrenceInterval?: number;
  recurrenceEndDate?: string;
  sourceRecurringTaskId?: string | null;
  comments: TaskComment[];
  history: TaskHistory[];
  createdAt: string;
  updatedAt: string;
}

// Plan & Schedule management
export interface FamilyPlan {
  id: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD HH:mm
  endDate: string; // YYYY-MM-DD HH:mm
  isRecurring: boolean;
  recurrenceType: "none" | "daily" | "weekly" | "monthly";
  creatorId: string;
  isShared: boolean;
  color: string; // e.g. 'emerald', 'sky', 'amber', 'rose'
  createdAt: string;
}

// Note management
export interface Note {
  id: string;
  title: string;
  content: string; // Markdown supported
  isPinned: boolean;
  creatorId: string;
  tags: string[];
  isShared: boolean;
  allowedRolesToEdit: UserRole[]; // Which roles can edit this note
  createdAt: string;
  updatedAt: string;
}

// Financial system
export enum TransactionType {
  INCOME = "income",
  EXPENSE = "expense"
}

export enum ExpenseCategory {
  FOOD = "food",           // Ăn uống
  EDUCATION = "education2", // Học tập / Học phí
  UTILITIES = "utilities", // Điện nước / Gas
  SHOPPING = "shopping",   // Mua sắm
  MEDICAL = "medical",     // Y tế / Sức khỏe
  TRANSPORT = "transport", // Đi lại / Xăng xe
  OTHER = "other"          // Khác
}

export enum AccountType {
  CASH = "cash",         // Tiền mặt
  BANK = "bank",         // Ngân hàng
  E_WALLET = "e_wallet"  // Ví điện tử
}

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: ExpenseCategory | string;
  account: AccountType;
  description: string;
  date: string; // YYYY-MM-DD
  creatorId: string;
  receiptImage?: string; // Base64 data-uri or image url
  createdAt: string;
}

export interface RewardPointEntry {
  id: string;
  userId: string;
  taskId?: string;
  points: number;
  reason: string;
  createdById: string;
  createdAt: string;
}

export interface BudgetLimit {
  id: string;
  month: string; // YYYY-MM
  category: ExpenseCategory | string;
  limit: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringBill {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory | string;
  account: AccountType;
  frequency: "weekly" | "monthly" | "yearly";
  nextDueDate: string; // YYYY-MM-DD
  notes?: string;
  isActive: boolean;
  lastPaidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationReminder {
  id: string;
  name: string;
  dosage: string;
  patientId: string;
  times: string[]; // HH:mm values
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shopping / grocery list
export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string; // free text e.g. "2 kg", "1 hộp"
  note?: string;
  isPurchased: boolean;
  creatorId: string;
  purchasedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Database schema container
export interface FamilyOrganizerDB {
  users: (User & { passwordHash: string })[];
  tasks: Task[];
  plans: FamilyPlan[];
  notes: Note[];
  transactions: FinancialTransaction[];
  rewardLedger: RewardPointEntry[];
  budgets: BudgetLimit[];
  recurringBills: RecurringBill[];
  medications: MedicationReminder[];
  shoppingItems: ShoppingItem[];
  notifications: Notification[];
  activityLogs: {
    id: string;
    userId: string;
    username: string;
    action: string;
    details: string;
    createdAt: string;
  }[];
  backups: {
    id: string;
    filename: string;
    createdAt: string;
    sizeKb: number;
    type: "auto" | "manual";
  }[];
}
