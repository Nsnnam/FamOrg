/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
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
  FileText
} from "lucide-react";
import { FinancialTransaction, TransactionType, ExpenseCategory, AccountType, User, UserRole } from "../types.js";
import { motion, AnimatePresence } from "motion/react";

interface FinanceProps {
  currentUser: User;
  users: User[];
  transactions: FinancialTransaction[];
  onSaveTransaction: (tx: Partial<FinancialTransaction>) => Promise<any>;
  onDeleteTransaction: (id: string) => Promise<any>;
}

export function Finance({
  currentUser,
  users,
  transactions,
  onSaveTransaction,
  onDeleteTransaction
}: FinanceProps) {
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

  // Create fields
  const [formType, setFormType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<ExpenseCategory | string>(ExpenseCategory.FOOD);
  const [formAccount, setFormAccount] = useState<AccountType>(AccountType.BANK);
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReceiptBase64, setFormReceiptBase64] = useState<string>("");

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

  // Group by category to build the visual Chart distribution
  const chartCategoryDistribution = useMemo(() => {
    const list: Record<string, number> = {};
    // Calculate only for "expenses" in the current active month/year or overall filtered set to make it responsive
    filteredTransactions.filter(tx => tx.type === "expense").forEach(tx => {
      list[tx.category] = (list[tx.category] || 0) + tx.amount;
    });

    return Object.entries(list).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // File selected converter
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Hóa đơn đính kèm không được lớn dạng 2MB!");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFormReceiptBase64(reader.result);
      }
    };
    reader.onerror = (error) => {
      console.error("Lỗi chuyển Base64 hóa đơn:", error);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (formAmount <= 0) {
      setFormError("Số tiền phát sinh phải lớn hơn 0đ!");
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

  const handleDeleteClick = async (txId: string) => {
    if (confirm("Gia đình có chắc muốn xóa bản ghi chi tiêu này không?")) {
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
            disabled={currentUser.role === UserRole.GUEST}
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
                    {(currentUser.role !== UserRole.GUEST && (currentUser.role === UserRole.ADMIN || tx.creatorId === currentUser.id)) && (
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="text-slate-400 block font-semibold">Số lượng (VNĐ) <span className="text-rose-400">*</span></label>
                  <input 
                    type="number" 
                    placeholder="Điền số giá trị..."
                    value={formAmount || ""}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-bold"
                  />
                </div>

                <div className="space-y-1 col-span-1">
                  <label className="text-slate-400 block font-semibold">Mốc ngày sự kiện</label>
                  <input 
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Categorization and Wallet */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
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
                <label className="text-slate-400 block font-semibold mb-1">Đính kèm ảnh chụp hóa đơn (Tối ưu nhẹ dưới 2MB)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-slate-400 font-mono text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-sky-400 file:cursor-pointer hover:file:bg-slate-755"
                />
                
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

              <div className="flex items-center justify-end gap-2.5 pt-3">
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
          <div className="relative max-w-full max-h-[85vh] p-1.5 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
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
    </div>
  );
}
