/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User and Role management
// `role` is the PERMISSION tier (what the account can do).
// `familyRelation` (below) is just a display label for who the person is in the family.
export enum UserRole {
  ADMIN = "admin",   // Toàn quyền (thường là Ba/Mẹ)
  MEMBER = "member", // Người lớn: quản lý nội dung của mình + chi tiêu
  CHILD = "child",   // Con/Trẻ em: tự tạo việc/ghi chú/sự kiện của mình, nhận điểm thưởng, KHÔNG xem chi tiêu
  GUEST = "guest"    // Khách: chỉ xem nội dung được chia sẻ
}

// Family relationship — display label only, does NOT affect permissions.
export type FamilyRelation =
  | "ong_noi" | "ba_noi" | "ong_ngoai" | "ba_ngoai"
  | "ba" | "me" | "con" | "anh_chi_em" | "khach" | "khac";

export const FAMILY_RELATION_LABELS: Record<FamilyRelation, string> = {
  ong_noi: "Ông nội",
  ba_noi: "Bà nội",
  ong_ngoai: "Ông ngoại",
  ba_ngoai: "Bà ngoại",
  ba: "Ba",
  me: "Mẹ",
  con: "Con",
  anh_chi_em: "Anh/Chị/Em",
  khach: "Khách",
  khac: "Khác"
};

// Human-friendly Vietnamese labels for the permission tier.
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Quản lý (Admin)",
  [UserRole.MEMBER]: "Thành viên",
  [UserRole.CHILD]: "Con (Trẻ em)",
  [UserRole.GUEST]: "Khách"
};

// --- Centralized permission policy (shared by client & server) ---
// Adults (Admin/Member) manage finance, medication, awarding rewards.
export const isAdultRole = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.MEMBER;
// Finance & medication modules are hidden from Child and Guest.
export const canAccessFinance = (role: UserRole) => isAdultRole(role);
export const canManageMedication = (role: UserRole) => isAdultRole(role);
// Admin/Member/Child can create their own content; Guest is read-only.
export const canCreateContent = (role: UserRole) => role !== UserRole.GUEST;
// Child & Guest have a restricted view (only shared + their own/assigned items).
export const isLimitedViewer = (role: UserRole) => role === UserRole.CHILD || role === UserRole.GUEST;
// Only Child accounts accumulate reward points.
export const earnsRewardPoints = (role: UserRole) => role === UserRole.CHILD;

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  familyRelation?: FamilyRelation; // Display-only relationship label (Ông/Bà/Ba/Mẹ/Con/Khách...)
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

export type AssetType =
  | "crypto"
  | "land"
  | "gold_bar"
  | "gold_ring"
  | "gold_jewelry"
  | "gold_other"
  | "vehicle"
  | "stock"
  | "other";

export interface AssetPhoto {
  id: string;
  fileName: string;
  thumbnailDataUrl: string;
  fullDataUrl: string;
  width: number;
  height: number;
  sizeKb: number;
  createdAt: string;
}

export interface FamilyAsset {
  id: string;
  type: AssetType;
  name: string;
  ownerId?: string;
  quantity: number;
  unit: string;
  estimatedValue: number;
  purchaseValue?: number;
  currency: "VND" | "USD";
  purchaseDate?: string;
  location?: string;
  notes?: string;
  photos: AssetPhoto[];
  symbol?: string;
  network?: string;
  walletLabel?: string;
  walletAddressMasked?: string;
  address?: string;
  areaM2?: number;
  certificateNo?: string;
  parcelNo?: string;
  goldPurity?: string;
  weight?: number;
  weightUnit?: string;
  brand?: string;
  serialNo?: string;
  createdById: string;
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

// A Web Push subscription tied to one user's device/browser. Used to deliver
// system notifications + app-icon badge even when the PWA is closed.
export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string; // unique per device; used as the dedupe / removal key
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: { p256dh: string; auth: string };
  };
  userAgent?: string;
  createdAt: string;
}

// --- Meal planner dish library (grows over time from AI suggestions) ---
// "onedish" = bữa một tô/dĩa đầy đủ (bún, phở, cơm tấm…), không cần cơm + món mặn + canh kèm theo.
export type DishSlot = "breakfast" | "main" | "side" | "fruit" | "onedish";
export type FoodCategory = "Đạm" | "Rau củ" | "Tinh bột" | "Trái cây" | "Gia vị";
export interface MealIngredient {
  name: string;
  cat: FoodCategory;
  adult?: number; // per-adult amount; omitted for AI-learned dishes (name-only)
  child?: number; // per-child amount
  unit?: string;  // "g" = weight; otherwise a countable unit (quả, bó, củ…)
}
export interface StoredDish {
  id: string;
  name: string;
  slot: DishSlot;
  ingredients: MealIngredient[];
  source: "seed" | "ai";
  createdAt: string;
}

// The one shared weekly menu shown on the shopping view (persisted & synced).
export interface StoredMealPlan {
  days: { day: number; meals: { meal: string; dishes: string[] }[] }[];
  groceries: { name: string; cat: FoodCategory; quantity: string }[];
  source: string;
  adults: number;
  children: number;
  updatedAt: string;
  updatedById: string;
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
  assets: FamilyAsset[];
  medications: MedicationReminder[];
  shoppingItems: ShoppingItem[];
  dishLibrary: StoredDish[];
  mealPlan?: StoredMealPlan | null;
  notifications: Notification[];
  pushSubscriptions: PushSubscriptionRecord[];
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
