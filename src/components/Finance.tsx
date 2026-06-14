/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Trash2, 
  Search, 
  Calendar, 
  Image as ImageIcon, 
  ChevronRight, 
  DollarSign, 
  Filter, 
  X,
  CreditCard,
  FileText,
  CheckCircle2,
  Pencil
} from "lucide-react";
import { FinancialTransaction, TransactionType, ExpenseCategory, AccountType, User, UserRole, BudgetLimit, RecurringBill, FamilyAsset, canAccessFinance } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { useConfirm } from "./ConfirmDialog.js";
import { Assets } from "./Assets.js";
import { optimizeAndUpload } from "../utils/uploadImage.js";
import { useModalA11y } from "../hooks/useModalA11y.js";

interface FinanceProps {
  currentUser: User;
  users: User[];
  transactions: FinancialTransaction[];
  budgets: BudgetLimit[];
  recurringBills: RecurringBill[];
  assets: FamilyAsset[];
  widgets?: any;
  onSaveTransaction: (tx: Partial<FinancialTransaction>) => Promise<any>;
  onDeleteTransaction: (id: string) => Promise<any>;
  onSaveBudget: (budget: Partial<BudgetLimit>) => Promise<any>;
  onDeleteBudget: (id: string) => Promise<any>;
  onSaveRecurringBill: (bill: Partial<RecurringBill>) => Promise<any>;
  onPayRecurringBill: (id: string) => Promise<any>;
  onDeleteRecurringBill: (id: string) => Promise<any>;
  onSaveAsset: (asset: Partial<FamilyAsset>) => Promise<any>;
  onDeleteAsset: (id: string) => Promise<any>;
}

const BILL_CATEGORIES = [
  { value: "rent",       label: "Thuê nhà" },
  { value: "utilities",  label: "Điện nước" },
  { value: "internet",   label: "Cước Internet" },
  { value: "phone",      label: "Điện thoại" },
  { value: "insurance",  label: "Bảo hiểm" },
  { value: "medical",    label: "Y tế" },
  { value: "education2", label: "Học tập" },
  { value: "other",      label: "Khác" },
] as const;

function translateBillCategory(value: string): string {
  return BILL_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

function isAlreadyPaidThisPeriod(bill: RecurringBill): boolean {
  if (!bill.lastPaidDate) return false;
  const today = new Date();
  const paid = new Date(bill.lastPaidDate);
  if (bill.frequency === "monthly")
    return paid.getFullYear() === today.getFullYear() && paid.getMonth() === today.getMonth();
  if (bill.frequency === "yearly")
    return paid.getFullYear() === today.getFullYear();
  // weekly: paid within last 7 days
  return today.getTime() - paid.getTime() < 7 * 24 * 60 * 60 * 1000;
}

function payButtonLabel(frequency: RecurringBill["frequency"]): string {
  if (frequency === "weekly") return "Trả tuần này";
  if (frequency === "yearly") return "Trả năm này";
  return "Trả tháng này";
}

export function Finance({
  currentUser,
  users,
  transactions,
  budgets,
  recurringBills,
  assets,
  widgets,
  onSaveTransaction,
  onDeleteTransaction,
  onSaveBudget,
  onDeleteBudget,
  onSaveRecurringBill,
  onPayRecurringBill,
  onDeleteRecurringBill,
  onSaveAsset,
  onDeleteAsset
}: FinanceProps) {
  const [financeView, setFinanceView] = useState<"cashflow" | "assets">("cashflow");
  // Query Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");

  // Interactive controls
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  // In-app confirmation dialog (replaces native browser confirm)
  const { confirm, ConfirmDialog } = useConfirm();

  // Create fields
  const [formType, setFormType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<ExpenseCategory | string>(ExpenseCategory.FOOD);
  const [formAccount, setFormAccount] = useState<AccountType>(AccountType.BANK);
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReceiptBase64, setFormReceiptBase64] = useState<string>("");
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState<string>(ExpenseCategory.FOOD);
  const [budgetLimit, setBudgetLimit] = useState<number>(0);
  const [budgetError, setBudgetError] = useState("");
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState<number>(0);
  const [billDueDate, setBillDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [billCategory, setBillCategory] = useState<string>(ExpenseCategory.UTILITIES);
  const [billFrequency, setBillFrequency] = useState<RecurringBill["frequency"]>("monthly");
  const [billError, setBillError] = useState("");
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCategory, setEditCategory] = useState<string>(BILL_CATEGORIES[0].value);
  const [editFrequency, setEditFrequency] = useState<RecurringBill["frequency"]>("monthly");
  const [editDueDate, setEditDueDate] = useState("");
  const [editError, setEditError] = useState("");

  // Escape-to-close + scroll lock + focus trap for the form, receipt viewer & bill editor
  const formRef = useRef<HTMLDivElement | null>(null);
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const billEditorRef = useRef<HTMLDivElement | null>(null);
  const closeForm = useCallback(() => setIsFormOpen(false), []);
  const closeReceipt = useCallback(() => setSelectedReceipt(null), []);
  const closeBillEditor = useCallback(() => setEditingBill(null), []);
  useModalA11y(isFormOpen, closeForm, formRef);
  useModalA11y(!!selectedReceipt, closeReceipt, receiptRef);
  useModalA11y(!!editingBill, closeBillEditor, billEditorRef);

  // Money input formatting: show grouped thousands (1.000.000), store as number.
  const formatMoneyInput = (n: number) => (n > 0 ? n.toLocaleString("vi-VN") : "");
  const parseMoneyInput = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

  // Process filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Text description search
      if (searchTerm && !tx.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      // 2. Category
      if (categoryFilter !== "all" && tx.category !== categoryFilter) return false;

      // 3. Account wallet
      if (accountFilter !== "all" && tx.account !== accountFilter) return false;

      // 4. Type
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;

      // 5. Creator member
      if (memberFilter !== "all" && tx.creatorId !== memberFilter) return false;

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, searchTerm, categoryFilter, accountFilter, typeFilter, memberFilter]);

  // Overall Balances Calculations
  const metrics = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    
    // Calculate for filtered set or full set? Full set provides better overview, so we calculate for the full set!
    transactions.forEach(tx => {
      if (tx.type === "income") {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }
    });

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    };
  }, [transactions]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthBudgets = useMemo(
    () => budgets.filter(b => b.month === currentMonth),
    [budgets, currentMonth]
  );

  const budgetUsage = useMemo(() => {
    const spent: Record<string, number> = {};
    transactions
      .filter(tx => tx.type === "expense" && tx.date.startsWith(currentMonth))
      .forEach(tx => {
        spent[tx.category] = (spent[tx.category] || 0) + tx.amount;
      });
    return spent;
  }, [transactions, currentMonth]);

  // Group by category to build the visual Chart distribution
  const chartCategoryDistribution = useMemo(() => {
    const list: Record<string, number> = {};
    // Calculate only for "expenses" in the current active month/year or overall filtered set to make it responsive
    filteredTransactions.filter(tx => tx.type === "expense").forEach(tx => {
      list[tx.category] = (list[tx.category] || 0) + tx.amount;
    });

    return Object.entries(list).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Optimize the receipt photo in the browser, then store it as a file (DB keeps only the URL).
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFormError("");
    setReceiptProcessing(true);
    try {
      const uploaded = await optimizeAndUpload(file, "receipts", {
        maxSourceBytes: 20 * 1024 * 1024,
        targetBytes: 600 * 1024,
        maxSizes: [1280, 1024, 768],
        qualities: [0.82, 0.72, 0.62],
        backgroundColor: "#ffffff"
      });
      setFormReceiptBase64(uploaded.url);
    } catch (err: any) {
      setFormError(err.message || "Không xử lý được ảnh hóa đơn.");
    } finally {
      setReceiptProcessing(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (formAmount <= 0) {
      setFormError("Số tiền phải lớn hơn 0đ!");
      return;
    }
    if (!formDesc.trim()) {
      setFormError("Vui lòng nhập nội dung chi tiêu!");
      return;
    }

    const payload: Partial<FinancialTransaction> = {
      type: formType,
      amount: Number(formAmount),
      category: formCategory,
      account: formAccount,
      description: formDesc.trim(),
      date: formDate,
      receiptImage: formReceiptBase64 || undefined
    };

    try {
      await onSaveTransaction(payload);
      // Reset
      setFormAmount(0);
      setFormDesc("");
      setFormReceiptBase64("");
      setFormDate(new Date().toISOString().slice(0, 10));
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Không thể lưu giao dịch này");
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetError("");
    if (budgetLimit <= 0) {
      setBudgetError("Han muc phai lon hon 0");
      return;
    }
    try {
      await onSaveBudget({ month: currentMonth, category: budgetCategory, limit: Number(budgetLimit) });
      setBudgetLimit(0);
    } catch (err: any) {
      setBudgetError(err.message || "Khong luu duoc ngan sach");
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillError("");
    if (!billTitle.trim() || billAmount <= 0) {
      setBillError("Nhap ten hoa don va so tien hop le");
      return;
    }
    try {
      await onSaveRecurringBill({
        title: billTitle.trim(),
        amount: Number(billAmount),
        category: billCategory,
        account: AccountType.BANK,
        frequency: billFrequency,
        nextDueDate: billDueDate,
        isActive: true
      });
      setBillTitle("");
      setBillAmount(0);
    } catch (err: any) {
      setBillError(err.message || "Khong luu duoc hoa don");
    }
  };

  const handleOpenEditBill = (b: RecurringBill) => {
    setEditingBill(b);
    setEditTitle(b.title);
    setEditAmount(b.amount);
    setEditCategory(b.category);
    setEditFrequency(b.frequency);
    setEditDueDate(b.nextDueDate);
    setEditError("");
  };

  const handleSaveEditBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill) return;
    setEditError("");
    if (!editTitle.trim() || editAmount <= 0) {
      setEditError("Nhập tên và số tiền hợp lệ");
      return;
    }
    try {
      await onSaveRecurringBill({
        id: editingBill.id,
        title: editTitle.trim(),
        amount: Number(editAmount),
        category: editCategory,
        frequency: editFrequency,
        nextDueDate: editDueDate,
      });
      setEditingBill(null);
    } catch (err: any) {
      setEditError(err.message || "Không thể lưu thay đổi");
    }
  };

  const handleDeleteClick = async (txId: string) => {
    const ok = await confirm({
      title: "Xóa bản ghi chi tiêu?",
      message: "Bản ghi tài chính này sẽ bị xóa vĩnh viễn khỏi sổ quỹ gia đình. Bạn có chắc chắn muốn tiếp tục không?",
      confirmLabel: "Xóa bản ghi",
      tone: "danger"
    });
    if (ok) {
      await onDeleteTransaction(txId);
    }
  };

  // Naming converters
  const translateCategory = (cat: string) => {
    switch (cat) {
      case "food": return "Ăn uống 🍲";
      case "education2": return "Học tập / Học phí 📚";
      case "utilities": return "Điện nước / Sinh hoạt ⚡";
      case "shopping": return "Mua sắm quần áo 🛍️";
      case "medical": return "Y tế / Chăm sóc sức khỏe 💊";
      case "transport": return "Phương tiện đi lại 🚗";
      default: return cat;
    }
  };

  const translateAccount = (acc: string) => {
    switch (acc) {
      case "cash": return "Tiền mặt 💵";
      case "bank": return "Ngân hàng chuyển khoản 💳";
      case "e_wallet": return "Ví điện tử MoMo/ZaloPay 📱";
      default: return acc;
    }
  };

  const categoryColorClass = (cat: string) => {
    switch (cat) {
      case "food": return "text-emerald-400 bg-emerald-500/10";
      case "education2": return "text-violet-400 bg-violet-500/10";
      case "utilities": return "text-amber-400 bg-amber-500/10";
      case "shopping": return "text-pink-400 bg-pink-500/10";
      case "medical": return "text-rose-400 bg-rose-500/10";
      case "transport": return "text-sky-400 bg-sky-500/10";
      default: return "text-slate-400 bg-slate-800";
    }
  };

  return (
    <div className="space-y-6" id="finance-module">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-xl flex flex-col sm:flex-row gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setFinanceView("cashflow")}
          className={`flex-1 px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${financeView === "cashflow" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
        >
          <Wallet className="w-4 h-4" /> Thu chi & ngân sách
        </button>
        <button
          type="button"
          onClick={() => setFinanceView("assets")}
          className={`flex-1 px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${financeView === "assets" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
        >
          <FileText className="w-4 h-4" /> Tài sản gia đình
        </button>
      </div>

      {financeView === "assets" ? (
        <Assets
          currentUser={currentUser}
          users={users}
          assets={assets}
          widgets={widgets}
          onSaveAsset={onSaveAsset}
          onDeleteAsset={onDeleteAsset}
        />
      ) : (
        <>
      
      {/* Wallet Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="finance-summaries">
        
        {/* Total balance card */}
        <div className="bg-radial from-slate-900 to-slate-950 border border-slate-850 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold">Tích quỹ số dư</span>
            <div className={`p-2 rounded-xl ${metrics.balance >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className={`text-2xl md:text-3xl font-extrabold font-sans tracking-tight ${metrics.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {metrics.balance.toLocaleString()} VNĐ
            </h3>
            <p className="text-slate-500 text-[10px] uppercase font-mono">Dòng tiền hiện khả dụng</p>
          </div>
        </div>

        {/* Total Income card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold">Tổng nguồn thu nhập</span>
            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className="text-2xl font-extrabold text-slate-100 font-sans tracking-tight">
              +{metrics.totalIncome.toLocaleString()} VNĐ
            </h3>
            <p className="text-slate-500 text-[10px] uppercase font-mono">Doanh thu / Quỹ đóng góp</p>
          </div>
        </div>

        {/* Total Expense card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold">Tổng chi tiêu rút ra</span>
            <div className="bg-rose-500/10 p-2 rounded-xl text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className="text-2xl font-extrabold text-slate-100 font-sans tracking-tight">
              -{metrics.totalExpense.toLocaleString()} VNĐ
            </h3>
            <p className="text-slate-500 text-[10px] uppercase font-mono">Mua sắm & Sinh hoạt phí</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" id="finance-planning">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Ngân sách tháng {currentMonth}</h3>
            <span className="text-[10px] text-slate-500 font-mono">{currentMonthBudgets.length} hạn mức</span>
          </div>
          <form onSubmit={handleCreateBudget} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 text-xs">
            <select
              value={budgetCategory}
              onChange={(e) => setBudgetCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
            >
              <option value="food">Ăn uống</option>
              <option value="education2">Học tập</option>
              <option value="utilities">Điện nước</option>
              <option value="shopping">Mua sắm</option>
              <option value="medical">Y tế</option>
              <option value="transport">Đi lại</option>
              <option value="other">Khác</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={formatMoneyInput(budgetLimit)}
              onChange={(e) => setBudgetLimit(parseMoneyInput(e.target.value))}
              placeholder="Hạn mức"
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
            />
            <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl px-3 py-2 font-bold">
              Lưu
            </button>
          </form>
          {budgetError && <p className="text-[11px] text-rose-400">{budgetError}</p>}
          <div className="space-y-2">
            {currentMonthBudgets.length === 0 ? (
              <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có ngân sách cho tháng này.</p>
            ) : currentMonthBudgets.map(b => {
              const used = budgetUsage[b.category] || 0;
              const pct = Math.min(100, Math.round((used / b.limit) * 100));
              return (
                <div key={b.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{translateCategory(b.category)}</span>
                    <button onClick={() => onDeleteBudget(b.id)} className="text-slate-500 hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className={`h-full ${used > b.limit ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">{used.toLocaleString()} / {b.limit.toLocaleString()} VNĐ</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Hóa đơn định kỳ</h3>
            <span className="text-[10px] text-slate-500 font-mono">{recurringBills.length} khoản</span>
          </div>
          <form onSubmit={handleCreateBill} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <input value={billTitle} onChange={(e) => setBillTitle(e.target.value)} placeholder="Tên hóa đơn" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none" />
            <input type="text" inputMode="numeric" value={formatMoneyInput(billAmount)} onChange={(e) => setBillAmount(parseMoneyInput(e.target.value))} placeholder="Số tiền" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none" />
            <input type="date" value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none" />
            <select value={billFrequency} onChange={(e) => setBillFrequency(e.target.value as RecurringBill["frequency"])} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
              <option value="weekly">Hàng tuần</option>
              <option value="monthly">Hàng tháng</option>
              <option value="yearly">Hàng năm</option>
            </select>
            <select value={billCategory} onChange={(e) => setBillCategory(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
              {BILL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl px-3 py-2 font-bold">Thêm hóa đơn</button>
          </form>
          {billError && <p className="text-[11px] text-rose-400">{billError}</p>}
          <div className="space-y-2">
            {recurringBills.length === 0 ? (
              <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có hóa đơn lặp lại.</p>
            ) : recurringBills.map(b => (
              <div key={b.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">{b.title}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{b.amount.toLocaleString()} VNĐ • {translateBillCategory(b.category)} • hạn {b.nextDueDate}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isAlreadyPaidThisPeriod(b) ? (
                    <span className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Đã thanh toán
                    </span>
                  ) : (
                    <button
                      onClick={() => onPayRecurringBill(b.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-bold hover:bg-sky-500/20 transition-colors cursor-pointer"
                    >
                      <CreditCard className="w-3 h-3" /> {payButtonLabel(b.frequency)}
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEditBill(b)}
                    className="p-1.5 text-slate-500 hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Xóa hóa đơn định kỳ?",
                        message: `Xóa "${b.title}" sẽ không thể hoàn tác. Các giao dịch đã ghi nhận trước đó vẫn được giữ lại.`,
                        confirmLabel: "Xóa hóa đơn",
                        tone: "danger"
                      });
                      if (ok) onDeleteRecurringBill(b.id);
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced charts & breakdowns layout */}
      {chartCategoryDistribution.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6" id="finance-statistics">
          
          {/* Custom animated category distribution list */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Phân hóa hạng mục tiêu dùng</span>
            </h4>
            <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
              {chartCategoryDistribution.map(({ name, value }) => {
                const percentage = Math.round((value / metrics.totalExpense) * 100) || 0;
                return (
                  <div key={name} className="space-y-1 font-sans text-xs">
                    <div className="flex justify-between text-slate-300 font-medium pb-0.5">
                      <span>{translateCategory(name)}</span>
                      <span className="font-mono text-slate-400">{value.toLocaleString()}đ ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${percentage}%` }}
                        className="h-full bg-sky-500 rounded-full" 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fully Custom SVG Donut and slice Chart rendered statically for 100% stability */}
          <div className="flex flex-col items-center justify-center space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mũi phễu lưu lượng dòng tiền</span>
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#1e293b" strokeWidth="8" />
                {/* Active Ring */}
                {metrics.totalIncome + metrics.totalExpense > 0 ? (
                  <>
                    {/* Income arc green */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="38" 
                      fill="transparent" 
                      stroke="#10b981" 
                      strokeWidth="8" 
                      strokeDasharray={`${(metrics.totalIncome / (metrics.totalIncome + metrics.totalExpense)) * 238.7} 238.7`}
                    />
                    {/* Expense arc red */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="38" 
                      fill="transparent" 
                      stroke="#f43f5e" 
                      strokeWidth="8" 
                      strokeDasharray={`${(metrics.totalExpense / (metrics.totalIncome + metrics.totalExpense)) * 238.7} 238.7`}
                      strokeDashoffset={`-${(metrics.totalIncome / (metrics.totalIncome + metrics.totalExpense)) * 238.7}`}
                    />
                  </>
                ) : null}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Quỹ</span>
                <span className="text-xs font-bold text-slate-200">Gia Đình</span>
              </div>
            </div>
            <div className="flex gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Thu</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Chi</span>
            </div>
          </div>
        </div>
      )}

      {/* Query Filters blocks and create triggers row */}
      <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl space-y-3" id="finance-filters">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Tìm miêu tả khoản chi, mua đồ đạc gia đình..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none transition-all"
            />
          </div>

          <button 
            disabled={!canAccessFinance(currentUser.role)}
            onClick={() => {
              setFormError("");
              setIsFormOpen(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all self-start md:self-auto shrink-0 shadow-md shadow-emerald-500/5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Đăng ghi chép tài chính
          </button>
        </div>

        {/* Filters lists */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-[11px]">
          <div>
            <label className="text-slate-500 block mb-1">Loại quỹ</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:selection:outline-none"
            >
              <option value="all">Khoản thu & chi</option>
              <option value="income">Chỉ khoản Thu nhập (+)</option>
              <option value="expense">Chỉ khoản Chi tiêu (-)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Hạng mục chi</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:selection:outline-none"
            >
              <option value="all">Mọi hạng mục</option>
              <option value="food">Ăn uống 🍲</option>
              <option value="education2">Học tập 📚</option>
              <option value="utilities">Điền nước ⚡</option>
              <option value="shopping">Mua sắm 🛍️</option>
              <option value="medical">Y tế 💊</option>
              <option value="transport">Đi lại 🚗</option>
              <option value="other">Khoản khác 🏷️</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Ví tài khoản</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:selection:outline-none"
            >
              <option value="all">Mọi ví tài khoản</option>
              <option value="cash">Tiền mặt 💵</option>
              <option value="bank">Ngân hàng 💳</option>
              <option value="e_wallet">Ví điện tử 📱</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Thành viên thực hiện</label>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:selection:outline-none"
            >
              <option value="all">Cả gia đình</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Details List */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center" id="empty-transactions">
          <p className="text-sm text-slate-500">Bộ lọc chi tiêu không chứa kết quả phù hợp nào.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden" id="transactions-table">
          <div className="bg-slate-950 p-4 border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider flex justify-between items-center">
            <span>Dòng tiền chi tiết ({filteredTransactions.length} bản ghi)</span>
          </div>

          <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
            {filteredTransactions.map(tx => {
              const creator = users.find(u => u.id === tx.creatorId);
              const isIncome = tx.type === "income";

              return (
                <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-slate-850/40 transition-colors gap-3">
                  <div className="flex items-start gap-3.5">
                    {/* Small category bubble icon mapping */}
                    <div className={`p-2.5 rounded-xl shrink-0 font-bold ${isIncome ? "text-emerald-400 bg-emerald-500/10" : categoryColorClass(tx.category)}`}>
                      {isIncome ? <TrendingUp className="w-4.5 h-4.5" /> : <TrendingDown className="w-4.5 h-4.5" />}
                    </div>

                    <div className="space-y-1 text-xs">
                      {/* Description */}
                      <p className="text-slate-200 font-semibold text-sm leading-snug">{tx.description}</p>
                      
                      {/* Secondary descriptors */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                        {/* Date */}
                        <span className="flex items-center gap-1 font-mono text-[10px]"><Calendar className="w-3 h-3 text-slate-500" /> {tx.date}</span>
                        {/* Account */}
                        <span>{translateAccount(tx.account)}</span>
                        {/* Category tag */}
                        {!isIncome && <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 text-[10px]">#{translateCategory(tx.category).split(" ")[0]}</span>}
                        {/* Member user */}
                        {creator && <span className="text-[10px] font-semibold text-sky-400">@{creator.username}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right hand side action and value */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0自 mt-2 sm:mt-0 font-sans">
                    {/* Receipt handle */}
                    {tx.receiptImage ? (
                      <button 
                        onClick={() => setSelectedReceipt(tx.receiptImage!)}
                        className="flex items-center gap-1 bg-slate-950 text-sky-400 hover:bg-slate-850 border border-slate-800 text-[10px] px-2 py-1 rounded-lg cursor-pointer"
                        title="Xem ảnh hóa đơn"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Xem HĐ
                      </button>
                    ) : null}

                    {/* Monetary value block */}
                    <div className="text-right">
                      <span className={`text-base font-bold text-slate-100 ${isIncome ? "text-emerald-400 font-extrabold" : "text-rose-400 font-bold"}`}>
                        {isIncome ? "+" : "-"}{tx.amount.toLocaleString()} VNĐ
                      </span>
                    </div>

                    {/* Trash capacity */}
                    {(canAccessFinance(currentUser.role) && (currentUser.role === UserRole.ADMIN || tx.creatorId === currentUser.id)) && (
                      <button 
                        onClick={() => handleDeleteClick(tx.id)}
                        className="p-1.5 bg-slate-950 border border-slate-800 hover:text-rose-450 hover:bg-slate-800 rounded-lg text-slate-500 transition-all cursor-pointer"
                        title="Xóa biên bản này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Creation Modal Form */}
      {isFormOpen && (
        <div 
          onClick={() => setIsFormOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="finance-create-modal"
        >
          <motion.div
            ref={formRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800 shrink-0">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                <CreditCard className="w-5 h-5 text-sky-400" /> Ghi biên lai tài chính mới
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="flex flex-col min-h-0 flex-1 overflow-hidden text-xs">
              <div className="space-y-4 overflow-y-auto px-5 py-4 flex-1 min-h-0">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
                  {formError}
                </div>
              )}

              {/* Type toggle: Income vs Expense */}
              <div className="grid grid-cols-2 gap-2.5 bg-slate-950 p-1 rounded-xl border border-slate-800/80 font-bold text-center">
                <button 
                  type="button"
                  onClick={() => { setFormType(TransactionType.EXPENSE); setFormCategory(ExpenseCategory.FOOD); }}
                  className={`py-2 rounded-lg cursor-pointer transition-all ${formType === TransactionType.EXPENSE ? "bg-rose-500 text-slate-950" : "text-slate-400"}`}
                >
                  Ghi nhận CHI TIÊU (-)
                </button>
                <button 
                  type="button"
                  onClick={() => { setFormType(TransactionType.INCOME); setFormCategory("Lương tháng"); }}
                  className={`py-2 rounded-lg cursor-pointer transition-all ${formType === TransactionType.INCOME ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}
                >
                  Ghi nhận KHUÂN THU (+)
                </button>
              </div>

              {/* Description Input */}
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Nội dung chi chép <span className="text-rose-400">*</span></label>
                <input 
                  type="text" 
                  placeholder={formType === TransactionType.EXPENSE ? "Ví dụ: Đi chợ mua cá lóc, thanh toán hóa đơn điện nước..." : "Ví dụ: Nhận thưởng hoàn thành dự án, nhận lương tháng..."}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <label className="text-slate-400 block font-semibold">Số lượng (VNĐ) <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Điền số giá trị..."
                    value={formatMoneyInput(formAmount)}
                    onChange={(e) => setFormAmount(parseMoneyInput(e.target.value))}
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-bold"
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <label className="text-slate-400 block font-semibold">Mốc ngày sự kiện</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Categorization and Wallet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <label className="text-slate-400 block font-semibold">Hạng mục {formType === TransactionType.EXPENSE ? "chi phí" : "nguồn tiền"}</label>
                  {formType === TransactionType.EXPENSE ? (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="food">Ăn uống 🍲</option>
                      <option value="education2">Học tập 📚</option>
                      <option value="utilities">Điện nước ⚡</option>
                      <option value="shopping">Mua sắm 🛍️</option>
                      <option value="medical">Y tế 💊</option>
                      <option value="transport">Đi lại / Xăng xe 🚗</option>
                      <option value="other">Khoản khác 🏷️</option>
                    </select>
                  ) : (
                    <input 
                      type="text"
                      placeholder="Ví dụ: Khoản lương, trúng số, làm ngoài giờ..."
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Hình thức giao dịch</label>
                  <select
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value as AccountType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="bank">Tài khoản Ngân hàng 💳</option>
                    <option value="cash">Tiền mặt thủ công 💵</option>
                    <option value="e_wallet">Ví điện tử MoMo/ZaloPay 📱</option>
                  </select>
                </div>
              </div>

              {/* Receipt File upload */}
              <div className="space-y-1 bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                <label className="text-slate-400 block font-semibold mb-1">Đính kèm ảnh chụp hóa đơn (tự tối ưu trước khi lưu)</label>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handleFileChange}
                  disabled={receiptProcessing}
                  className="w-full text-slate-400 font-mono text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-sky-400 file:cursor-pointer hover:file:bg-slate-755 disabled:opacity-50"
                />
                {receiptProcessing && <p className="text-[10px] text-sky-400 mt-1">Đang tối ưu & tải ảnh hóa đơn...</p>}
                
                {formReceiptBase64 && (
                  <div className="mt-3 flex items-center justify-between bg-slate-900 p-2 border border-slate-800 rounded-lg">
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1">✔ Đã tải ảnh hóa đơn</span>
                    <button 
                      type="button" 
                      onClick={() => setFormReceiptBase64("")}
                      className="text-slate-500 hover:text-rose-400 stroke-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Đóng lại
                </button>
                <button 
                  type="submit" 
                  className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${formType === TransactionType.EXPENSE ? "bg-rose-500 hover:bg-rose-450 text-slate-950" : "bg-emerald-500 hover:bg-emerald-450 text-slate-950"}`}
                >
                  Lưu giao dịch
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Image Previewer Modal */}
      {selectedReceipt && (
        <div 
          onClick={() => setSelectedReceipt(null)}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center z-50 p-4 cursor-pointer"
          id="receipt-preview-modal"
        >
          <div ref={receiptRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Xem hóa đơn" className="relative max-w-full max-h-[85vh] p-1.5 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl outline-none">
            <img
              src={selectedReceipt}
              alt="Hóa đơn thanh toán" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-800 p-2 text-slate-250 border border-slate-800 hover:text-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      </>
      )}

      {/* Edit recurring bill modal */}
      {editingBill && (
        <div onClick={() => setEditingBill(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div ref={billEditorRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl outline-none">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-100">Chỉnh sửa hóa đơn định kỳ</h3>
              <button onClick={() => setEditingBill(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditBill} className="space-y-3 text-xs">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Tên hóa đơn"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              />
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(editAmount)}
                onChange={e => setEditAmount(parseMoneyInput(e.target.value))}
                placeholder="Số tiền"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              />
              <input
                type="date"
                value={editDueDate}
                onChange={e => setEditDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              />
              <select
                value={editFrequency}
                onChange={e => setEditFrequency(e.target.value as RecurringBill["frequency"])}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              >
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
                <option value="yearly">Hàng năm</option>
              </select>
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              >
                {BILL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {editError && <p className="text-[11px] text-rose-400">{editError}</p>}
              <p className="text-[10px] text-slate-500">Thay đổi không ảnh hưởng đến các kỳ đã thanh toán trước đó.</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl px-3 py-2 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl px-3 py-2 font-bold cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-app confirmation dialog */}
      {ConfirmDialog}
    </div>
  );
}
