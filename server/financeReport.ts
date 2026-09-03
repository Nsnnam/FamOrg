/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Báo cáo thu chi & chỉ tiêu ngân sách chính xác theo Ngày, Tuần, Tháng, Quý, Năm.
// Hỗ trợ truy vấn dữ liệu chi tiết, tính toán chỉ tiêu, tạo văn bản/HTML gửi Telegram,
// và cung cấp ngữ cảnh tài chính chuẩn xác 100% cho AI Assistant.

import { FamilyDB, getAppSettings } from "./db.js";
import { BudgetLimit, ExpenseCategory, FinancialTransaction, UserRole } from "../src/types.js";
import { SYSTEM_EXPENSE_CATEGORIES, SYSTEM_INCOME_CATEGORIES } from "../src/utils/financeCategories.js";

export type ReportPeriod = "day" | "week" | "month" | "quarter" | "year";

const CATEGORY_NAMES: Record<string, string> = {};
const CATEGORY_EMOJIS: Record<string, string> = {};

for (const c of SYSTEM_EXPENSE_CATEGORIES) {
  CATEGORY_NAMES[c.id] = c.name;
  CATEGORY_EMOJIS[c.id] = c.emoji;
}
for (const c of SYSTEM_INCOME_CATEGORIES) {
  CATEGORY_NAMES[c.id] = c.name;
  CATEGORY_EMOJIS[c.id] = c.emoji;
}
CATEGORY_NAMES["debt_bank"] = "Trả nợ ngân hàng";
CATEGORY_NAMES["debt_personal"] = "Trả nợ cá nhân";
CATEGORY_NAMES["food"] = "Ăn uống";
CATEGORY_NAMES["education2"] = "Học tập";
CATEGORY_NAMES["utilities"] = "Điện nước";
CATEGORY_NAMES["shopping"] = "Mua sắm";
CATEGORY_NAMES["medical"] = "Y tế";
CATEGORY_NAMES["transport"] = "Đi lại";
CATEGORY_NAMES["funeral"] = "Ma chay";
CATEGORY_NAMES["ceremony"] = "Hiếu hỉ";
CATEGORY_NAMES["other"] = "Khác";

export function getCategoryLabel(catId: string): string {
  return CATEGORY_NAMES[catId] || catId;
}

export function getCategoryEmoji(catId: string): string {
  return CATEGORY_EMOJIS[catId] || "🏷️";
}

export function fmtVND(n: number): string {
  return Math.round(n).toLocaleString("vi-VN") + "₫";
}

/** Trả về thông tin ngày giờ địa phương theo múi giờ Việt Nam (UTC+7) */
export function getVNTimeParts(date = new Date()) {
  const s = date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
  const local = new Date(s);
  const y = local.getFullYear();
  const m = local.getMonth() + 1; // 1-12
  const d = local.getDate();
  const dow = local.getDay(); // 0=CN, 1=T2...
  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dowLabel = dow === 0 ? "Chủ Nhật" : `Thứ ${dow + 1}`;
  return { y, m, d, dow, dateStr, dowLabel, local };
}

export interface PeriodDateRange {
  period: ReportPeriod;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // Nhãn hiển thị, vd "Hôm nay (03/09/2026)", "Tuần 01/09 – 07/09/2026"
  monthKeys: string[]; // Các khóa YYYY-MM nằm trong kỳ
  daysCount: number;
}

export function getPeriodRange(period: ReportPeriod, anchor = new Date()): PeriodDateRange {
  const { y, m, d, dow, dateStr, dowLabel, local } = getVNTimeParts(anchor);

  if (period === "day") {
    return {
      period: "day",
      startDate: dateStr,
      endDate: dateStr,
      label: `${dowLabel}, ngày ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
      monthKeys: [`${y}-${String(m).padStart(2, "0")}`],
      daysCount: 1
    };
  }

  if (period === "week") {
    // Thứ Hai = 1, Chủ Nhật = 0
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(local);
    mon.setDate(local.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const monP = getVNTimeParts(mon);
    const sunP = getVNTimeParts(sun);

    const monthKeys = new Set<string>();
    monthKeys.add(`${monP.y}-${String(monP.m).padStart(2, "0")}`);
    monthKeys.add(`${sunP.y}-${String(sunP.m).padStart(2, "0")}`);

    return {
      period: "week",
      startDate: monP.dateStr,
      endDate: sunP.dateStr,
      label: `Tuần ${String(monP.d).padStart(2, "0")}/${String(monP.m).padStart(2, "0")} – ${String(sunP.d).padStart(2, "0")}/${String(sunP.m).padStart(2, "0")}/${sunP.y}`,
      monthKeys: Array.from(monthKeys),
      daysCount: 7
    };
  }

  if (period === "month") {
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    return {
      period: "month",
      startDate: `${y}-${mm}-01`,
      endDate: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
      label: `Tháng ${mm}/${y}`,
      monthKeys: [`${y}-${mm}`],
      daysCount: lastDay
    };
  }

  if (period === "quarter") {
    const q = Math.floor((m - 1) / 3) + 1; // 1, 2, 3, 4
    const startM = (q - 1) * 3 + 1;
    const endM = q * 3;
    const endLastDay = new Date(y, endM, 0).getDate();
    const startMM = String(startM).padStart(2, "0");
    const endMM = String(endM).padStart(2, "0");

    const monthKeys = [
      `${y}-${String(startM).padStart(2, "0")}`,
      `${y}-${String(startM + 1).padStart(2, "0")}`,
      `${y}-${String(endM).padStart(2, "0")}`
    ];

    const d1 = new Date(y, startM - 1, 1);
    const d2 = new Date(y, endM - 1, endLastDay);
    const daysCount = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;

    return {
      period: "quarter",
      startDate: `${y}-${startMM}-01`,
      endDate: `${y}-${endMM}-${String(endLastDay).padStart(2, "0")}`,
      label: `Quý ${q}/${y} (Tháng ${startM}–${endM}/${y})`,
      monthKeys,
      daysCount
    };
  }

  // year
  return {
    period: "year",
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
    label: `Năm ${y}`,
    monthKeys: Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`),
    daysCount: ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365
  };
}

export interface CategoryExpenseItem {
  category: string;
  categoryLabel: string;
  emoji: string;
  total: number;
  percentage: number; // % trên tổng chi
}

export interface CategoryIncomeItem {
  category: string;
  categoryLabel: string;
  emoji: string;
  total: number;
  percentage: number; // % trên tổng thu
}

export interface CategoryBudgetItem {
  category: string;
  categoryLabel: string;
  emoji: string;
  limit: number;
  spent: number;
  remaining: number;
  usedPercent: number;
  status: "ok" | "warning" | "exceeded"; // ok (<80%), warning (80-100%), exceeded (>100%)
}

export interface FinancialReport {
  period: ReportPeriod;
  range: PeriodDateRange;
  totalIncome: number;
  totalExpense: number;
  balance: number; // income - expense
  transactionCount: number;
  expenseByCategory: CategoryExpenseItem[];
  incomeByCategory: CategoryIncomeItem[];
  accounts: {
    cash: { income: number; expense: number; net: number };
    bank: { income: number; expense: number; net: number };
    e_wallet: { income: number; expense: number; net: number };
  };
  budgets: {
    hasBudgets: boolean;
    totalLimit: number;
    totalSpentInBudgeted: number;
    totalRemaining: number;
    overallUsedPercent: number;
    isOverBudget: boolean;
    items: CategoryBudgetItem[];
    exceededItems: CategoryBudgetItem[];
    warningItems: CategoryBudgetItem[];
  };
  recurringBillsDueCount: number;
  recurringBillsDueTotal: number;
  debtsSummary: {
    totalBorrowedRemaining: number; // mình đang nợ người khác
    totalLentRemaining: number;     // người khác nợ mình
    unsettledCount: number;
  };
  savingsGoalsSummary: {
    count: number;
    totalTarget: number;
    totalSaved: number;
    overallPercent: number;
  };
}

/** Tính toán báo cáo tài chính hoàn chỉnh và chính xác cho một kỳ */
export function getFinancialReport(period: ReportPeriod, anchor = new Date()): FinancialReport {
  const range = getPeriodRange(period, anchor);
  const db = FamilyDB["readRaw"]();

  // 1. Lọc giao dịch chính xác trong dải ngày
  const matchedTxs = db.transactions.filter(tx => {
    const d = (tx.date || tx.createdAt || "").slice(0, 10);
    return d >= range.startDate && d <= range.endDate;
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseCatMap: Record<string, number> = {};
  const incomeCatMap: Record<string, number> = {};
  const accounts = {
    cash: { income: 0, expense: 0, net: 0 },
    bank: { income: 0, expense: 0, net: 0 },
    e_wallet: { income: 0, expense: 0, net: 0 }
  };

  for (const tx of matchedTxs) {
    const acc = (tx.account || "cash") as "cash" | "bank" | "e_wallet";
    if (!accounts[acc]) accounts[acc] = { income: 0, expense: 0, net: 0 };

    if (tx.type === "income") {
      totalIncome += tx.amount;
      incomeCatMap[tx.category] = (incomeCatMap[tx.category] || 0) + tx.amount;
      accounts[acc].income += tx.amount;
      accounts[acc].net += tx.amount;
    } else {
      totalExpense += tx.amount;
      expenseCatMap[tx.category] = (expenseCatMap[tx.category] || 0) + tx.amount;
      accounts[acc].expense += tx.amount;
      accounts[acc].net -= tx.amount;
    }
  }

  const expenseByCategory: CategoryExpenseItem[] = Object.entries(expenseCatMap)
    .map(([cat, total]) => ({
      category: cat,
      categoryLabel: getCategoryLabel(cat),
      emoji: getCategoryEmoji(cat),
      total,
      percentage: totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  const incomeByCategory: CategoryIncomeItem[] = Object.entries(incomeCatMap)
    .map(([cat, total]) => ({
      category: cat,
      categoryLabel: getCategoryLabel(cat),
      emoji: getCategoryEmoji(cat),
      total,
      percentage: totalIncome > 0 ? Math.round((total / totalIncome) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  // 2. Chỉ tiêu ngân sách (Budgets)
  // Tính tổng chỉ tiêu theo hạng mục cho các tháng thuộc kỳ
  const relevantBudgets = db.budgets.filter(b => range.monthKeys.includes(b.month));
  const budgetLimitsByCat: Record<string, number> = {};

  for (const b of relevantBudgets) {
    budgetLimitsByCat[b.category] = (budgetLimitsByCat[b.category] || 0) + b.limit;
  }

  // Nếu là kỳ ngày hoặc tuần, tính hạn mức tỉ lệ theo số ngày
  // (ví dụ 1 ngày = 1/30 hạn mức tháng; 7 ngày = 7/30 hạn mức tháng)
  const isSubMonth = period === "day" || period === "week";
  const daysRatio = isSubMonth ? range.daysCount / 30 : 1;

  const budgetItems: CategoryBudgetItem[] = [];
  let totalLimit = 0;
  let totalSpentInBudgeted = 0;

  for (const [cat, rawLimit] of Object.entries(budgetLimitsByCat)) {
    const effectiveLimit = Math.round(rawLimit * daysRatio);
    const spent = expenseCatMap[cat] || 0;
    const remaining = effectiveLimit - spent;
    const usedPercent = effectiveLimit > 0 ? Math.round((spent / effectiveLimit) * 100) : 0;
    const status: CategoryBudgetItem["status"] =
      spent > effectiveLimit ? "exceeded" : (usedPercent >= 80 ? "warning" : "ok");

    totalLimit += effectiveLimit;
    totalSpentInBudgeted += spent;

    budgetItems.push({
      category: cat,
      categoryLabel: getCategoryLabel(cat),
      emoji: getCategoryEmoji(cat),
      limit: effectiveLimit,
      spent,
      remaining,
      usedPercent,
      status
    });
  }

  budgetItems.sort((a, b) => b.usedPercent - a.usedPercent);

  const exceededItems = budgetItems.filter(b => b.status === "exceeded");
  const warningItems = budgetItems.filter(b => b.status === "warning");
  const hasBudgets = budgetItems.length > 0;
  const totalRemaining = totalLimit - totalSpentInBudgeted;
  const overallUsedPercent = totalLimit > 0 ? Math.round((totalSpentInBudgeted / totalLimit) * 100) : 0;
  const isOverBudget = totalSpentInBudgeted > totalLimit || exceededItems.length > 0;

  // 3. Hóa đơn định kỳ (Recurring bills)
  const activeBills = (db.recurringBills || []).filter(b => b.isActive);
  let recurringBillsDueCount = 0;
  let recurringBillsDueTotal = 0;
  for (const b of activeBills) {
    if (b.nextDueDate && b.nextDueDate >= range.startDate && b.nextDueDate <= range.endDate) {
      recurringBillsDueCount++;
      recurringBillsDueTotal += b.amount;
    }
  }

  // 4. Công nợ (Debts)
  let totalBorrowedRemaining = 0;
  let totalLentRemaining = 0;
  let unsettledCount = 0;
  for (const d of db.debts || []) {
    if (!d.isSettled) {
      unsettledCount++;
      const paid = (d.payments || []).reduce((acc, p) => acc + p.amount, 0);
      const rem = Math.max(0, d.amount - paid);
      if (d.direction === "borrowed") totalBorrowedRemaining += rem;
      else totalLentRemaining += rem;
    }
  }

  // 5. Mục tiêu tiết kiệm (Savings goals)
  let totalTarget = 0;
  let totalSaved = 0;
  const goals = db.savingsGoals || [];
  for (const g of goals) {
    totalTarget += g.targetAmount;
    const current = (g.contributions || []).reduce((acc, c) => acc + c.amount, 0);
    totalSaved += current;
  }
  const overallPercent = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return {
    period,
    range,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    transactionCount: matchedTxs.length,
    expenseByCategory,
    incomeByCategory,
    accounts,
    budgets: {
      hasBudgets,
      totalLimit,
      totalSpentInBudgeted,
      totalRemaining,
      overallUsedPercent,
      isOverBudget,
      items: budgetItems,
      exceededItems,
      warningItems
    },
    recurringBillsDueCount,
    recurringBillsDueTotal,
    debtsSummary: {
      totalBorrowedRemaining,
      totalLentRemaining,
      unsettledCount
    },
    savingsGoalsSummary: {
      count: goals.length,
      totalTarget,
      totalSaved,
      overallPercent
    }
  };
}

/** Tạo văn bản HTML chuẩn gửi Telegram */
export function formatFinancialReportTelegramHtml(report: FinancialReport): string {
  const lines: string[] = [];
  const pName =
    report.period === "day" ? "ngày" :
    report.period === "week" ? "tuần" :
    report.period === "month" ? "tháng" :
    report.period === "quarter" ? "quý" : "năm";

  lines.push(`📊 <b>BÁO CÁO THU CHI & CHỈ TIÊU (${pName.toUpperCase()})</b>`);
  lines.push(`📅 <i>${report.range.label}</i>`);
  lines.push("");

  // 1. Tổng quan
  lines.push(`💰 <b>Tổng quan dòng tiền:</b>`);
  lines.push(`  • Thu: <b>${fmtVND(report.totalIncome)}</b>`);
  lines.push(`  • Chi: <b>${fmtVND(report.totalExpense)}</b> (${report.transactionCount} giao dịch)`);
  const sign = report.balance >= 0 ? "+" : "";
  const balEmoji = report.balance >= 0 ? "🟢" : "🔴";
  lines.push(`  • Dư: ${balEmoji} <b>${sign}${fmtVND(report.balance)}</b>`);
  lines.push("");

  // 2. Chỉ tiêu ngân sách (Chỉ tiêu)
  if (report.budgets.hasBudgets) {
    lines.push(`🎯 <b>Chỉ tiêu chi tiêu:</b>`);
    const bgStatusEmoji = report.budgets.isOverBudget ? "⚠️ VƯỢT HẠN MỨC" : "✅ Trong hạn mức";
    lines.push(`  • Đã dùng: <b>${fmtVND(report.budgets.totalSpentInBudgeted)}</b> / <b>${fmtVND(report.budgets.totalLimit)}</b> (${report.budgets.overallUsedPercent}%) — <i>${bgStatusEmoji}</i>`);

    if (report.budgets.totalRemaining >= 0) {
      lines.push(`  • Còn lại: <b>${fmtVND(report.budgets.totalRemaining)}</b>`);
    } else {
      lines.push(`  • Vượt mức: <b>-${fmtVND(Math.abs(report.budgets.totalRemaining))}</b>`);
    }

    // Liệt kê các mục vượt hoặc cảnh báo
    if (report.budgets.exceededItems.length > 0) {
      lines.push(`  🚨 <b>Mục vượt chỉ tiêu:</b>`);
      for (const it of report.budgets.exceededItems) {
        lines.push(`    - ${it.emoji} ${it.categoryLabel}: chi <b>${fmtVND(it.spent)}</b> / mức ${fmtVND(it.limit)} (<b>${it.usedPercent}%</b>, vượt ${fmtVND(it.spent - it.limit)})`);
      }
    }

    if (report.budgets.warningItems.length > 0) {
      lines.push(`  ⚠️ <b>Mục sắp chạm mức (&gt;80%):</b>`);
      for (const it of report.budgets.warningItems) {
        lines.push(`    - ${it.emoji} ${it.categoryLabel}: chi ${fmtVND(it.spent)} / mức ${fmtVND(it.limit)} (${it.usedPercent}%)`);
      }
    }
    lines.push("");
  }

  // 3. Top khoản chi
  if (report.expenseByCategory.length > 0) {
    lines.push(`🛍️ <b>Top chi tiêu nhiều nhất:</b>`);
    for (const c of report.expenseByCategory.slice(0, 5)) {
      lines.push(`  • ${c.emoji} ${c.categoryLabel}: <b>${fmtVND(c.total)}</b> (${c.percentage}%)`);
    }
    lines.push("");
  }

  // 4. Hóa đơn & công nợ
  if (report.recurringBillsDueCount > 0) {
    lines.push(`⏰ Hóa đơn định kỳ đến hạn: <b>${report.recurringBillsDueCount}</b> hóa đơn (${fmtVND(report.recurringBillsDueTotal)})`);
  }
  if (report.debtsSummary.unsettledCount > 0) {
    lines.push(`🤝 Nợ chưa tất toán: Đang nợ <b>${fmtVND(report.debtsSummary.totalBorrowedRemaining)}</b> | Đang cho mượn <b>${fmtVND(report.debtsSummary.totalLentRemaining)}</b>`);
  }

  return lines.join("\n");
}

/** Gửi báo cáo tài chính qua Telegram */
export async function sendFinancialReportTelegram(
  period: ReportPeriod,
  anchor = new Date(),
  options?: { chatId?: string; enhanceAi?: boolean }
): Promise<{ success: boolean; aiUsed: boolean; message: string }> {
  const s = getAppSettings();
  const token = s.telegramBotToken || "";
  const chatId = options?.chatId || s.telegramChatId || "";

  if (!token || !chatId) {
    throw new Error("Chưa cấu hình Telegram bot token / chat ID trong Thiết lập.");
  }

  const report = getFinancialReport(period, anchor);
  let html = formatFinancialReportTelegramHtml(report);
  let aiUsed = false;

  // Nếu cho phép AI và có key, nhờ AI viết lời bình ngắn dẫn nhập
  if (options?.enhanceAi !== false) {
    try {
      const { getAiConfig, aiGenerateText } = await import("./ai.js");
      if (getAiConfig().apiKey) {
        const prompt = `Dưới đây là số liệu báo cáo tài chính ${period} của gia đình:
Kỳ: ${report.range.label}
Thu: ${fmtVND(report.totalIncome)}, Chi: ${fmtVND(report.totalExpense)}, Dư: ${fmtVND(report.balance)}
Chỉ tiêu ngân sách: ${report.budgets.hasBudgets ? `Đã dùng ${report.budgets.overallUsedPercent}% (${report.budgets.isOverBudget ? 'VƯỢT' : 'an toàn'}). Vượt: ${report.budgets.exceededItems.map(x => x.categoryLabel).join(', ') || 'Không có'}` : 'Chưa đặt'}
Top chi: ${report.expenseByCategory.slice(0, 3).map(x => `${x.categoryLabel} ${fmtVND(x.total)}`).join(', ')}

Hãy viết một lời dẫn nhập và phân tích ngắn gọn (khoảng 3–4 câu, văn phong thân thiện, ấm áp, thực tế) để gắn vào đầu báo cáo Telegram.
Dùng thẻ <b> để in đậm số liệu, KHÔNG dùng markdown. Giữ nguyên tính chính xác của các con số.`;

        const aiComment = await aiGenerateText({ prompt, maxTokens: 400, timeoutMs: 15000 });
        if (aiComment && aiComment.trim()) {
          html = `${aiComment.trim()}\n\n━━━━━━━━━━━━━━━━━\n${html}`;
          aiUsed = true;
        }
      }
    } catch (err) {
      console.warn("[financeReport] AI enhancement failed, falling back to raw html:", err);
    }
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML" }),
    signal: AbortSignal.timeout(20000)
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram lỗi: ${data.description || `HTTP ${res.status}`}`);
  }

  return {
    success: true,
    aiUsed,
    message: `Đã gửi báo cáo ${period} qua Telegram.`
  };
}

/**
 * Tổng hợp toàn bộ ngữ cảnh tài chính chuẩn xác 100% để nạp vào prompt cho AI Assistant.
 * AI sẽ có số liệu chính xác tuyệt đối cho Hôm nay, Tuần này, Tháng này, Quý này
 * cùng chi tiết từng chỉ tiêu ngân sách (budget limits), không bao giờ bị tính sai hay bịa số.
 */
export function getComprehensiveFinancialContextForAI(now = new Date()) {
  const dayReport = getFinancialReport("day", now);
  const weekReport = getFinancialReport("week", now);
  const monthReport = getFinancialReport("month", now);
  const quarterReport = getFinancialReport("quarter", now);

  const { dateStr, dowLabel, y, m, d } = getVNTimeParts(now);

  return {
    thoi_gian_hien_tai_vietnam: {
      hom_nay: `${dowLabel}, ngày ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
      gio_dia_phuong: now.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      ngay_chuan_iso: dateStr,
      thang_hien_tai: `${y}-${String(m).padStart(2, "0")}`,
      quy_hien_tai: `Quý ${Math.floor((m - 1) / 3) + 1}/${y}`
    },
    hom_nay: {
      ky: dayReport.range.label,
      tong_thu: dayReport.totalIncome,
      tong_thu_vnd: fmtVND(dayReport.totalIncome),
      tong_chi: dayReport.totalExpense,
      tong_chi_vnd: fmtVND(dayReport.totalExpense),
      chenh_lech: dayReport.balance,
      chenh_lech_vnd: fmtVND(dayReport.balance),
      so_giao_dich: dayReport.transactionCount,
      top_chi_tieu: dayReport.expenseByCategory.slice(0, 5).map(c => ({
        hang_muc: c.categoryLabel,
        so_tien: c.total,
        vnd: fmtVND(c.total),
        ti_le_phan_tram: `${c.percentage}%`
      }))
    },
    tuan_nay: {
      ky: weekReport.range.label,
      tong_thu: weekReport.totalIncome,
      tong_thu_vnd: fmtVND(weekReport.totalIncome),
      tong_chi: weekReport.totalExpense,
      tong_chi_vnd: fmtVND(weekReport.totalExpense),
      chenh_lech: weekReport.balance,
      chenh_lech_vnd: fmtVND(weekReport.balance),
      so_giao_dich: weekReport.transactionCount,
      top_chi_tieu: weekReport.expenseByCategory.slice(0, 5).map(c => ({
        hang_muc: c.categoryLabel,
        so_tien: c.total,
        vnd: fmtVND(c.total),
        ti_le_phan_tram: `${c.percentage}%`
      }))
    },
    thang_nay: {
      ky: monthReport.range.label,
      tong_thu: monthReport.totalIncome,
      tong_thu_vnd: fmtVND(monthReport.totalIncome),
      tong_chi: monthReport.totalExpense,
      tong_chi_vnd: fmtVND(monthReport.totalExpense),
      chenh_lech: monthReport.balance,
      chenh_lech_vnd: fmtVND(monthReport.balance),
      so_giao_dich: monthReport.transactionCount,
      top_chi_tieu: monthReport.expenseByCategory.slice(0, 6).map(c => ({
        hang_muc: c.categoryLabel,
        so_tien: c.total,
        vnd: fmtVND(c.total),
        ti_le_phan_tram: `${c.percentage}%`
      })),
      chi_tieu_ngan_sach: {
        co_chi_tieu: monthReport.budgets.hasBudgets,
        tong_han_muc: monthReport.budgets.totalLimit,
        tong_han_muc_vnd: fmtVND(monthReport.budgets.totalLimit),
        tong_da_chi_theo_chi_tieu: monthReport.budgets.totalSpentInBudgeted,
        tong_da_chi_theo_chi_tieu_vnd: fmtVND(monthReport.budgets.totalSpentInBudgeted),
        con_lai: monthReport.budgets.totalRemaining,
        con_lai_vnd: fmtVND(monthReport.budgets.totalRemaining),
        phan_tram_da_dung: `${monthReport.budgets.overallUsedPercent}%`,
        trang_thai: monthReport.budgets.isOverBudget ? "VƯỢT CHỈ TIÊU" : "TRONG HẠN MỨC",
        cac_muc_vuot_chi_tieu: monthReport.budgets.exceededItems.map(it => ({
          hang_muc: it.categoryLabel,
          da_chi: fmtVND(it.spent),
          han_muc: fmtVND(it.limit),
          vuot_muc: fmtVND(it.spent - it.limit),
          phan_tram: `${it.usedPercent}%`
        })),
        chi_tiet_tung_hang_muc: monthReport.budgets.items.map(it => ({
          hang_muc: it.categoryLabel,
          da_chi: fmtVND(it.spent),
          han_muc: fmtVND(it.limit),
          con_lai: fmtVND(it.remaining),
          phan_tram: `${it.usedPercent}%`,
          trang_thai: it.status === "exceeded" ? "VƯỢT HẠN MỨC" : (it.status === "warning" ? "CẢNH BÁO (>80%)" : "AN TOÀN")
        }))
      }
    },
    quy_nay: {
      ky: quarterReport.range.label,
      tong_thu: quarterReport.totalIncome,
      tong_thu_vnd: fmtVND(quarterReport.totalIncome),
      tong_chi: quarterReport.totalExpense,
      tong_chi_vnd: fmtVND(quarterReport.totalExpense),
      chenh_lech: quarterReport.balance,
      chenh_lech_vnd: fmtVND(quarterReport.balance),
      so_giao_dich: quarterReport.transactionCount,
      top_chi_tieu: quarterReport.expenseByCategory.slice(0, 5).map(c => ({
        hang_muc: c.categoryLabel,
        so_tien: c.total,
        vnd: fmtVND(c.total),
        ti_le_phan_tram: `${c.percentage}%`
      }))
    },
    cong_no: {
      tong_dang_no_nguoi_khac: fmtVND(monthReport.debtsSummary.totalBorrowedRemaining),
      tong_nguoi_khac_no_minh: fmtVND(monthReport.debtsSummary.totalLentRemaining),
      so_khoan_no_chua_tat_toan: monthReport.debtsSummary.unsettledCount
    },
    tiet_kiem: {
      so_muc_tieu: monthReport.savingsGoalsSummary.count,
      tong_muc_tieu: fmtVND(monthReport.savingsGoalsSummary.totalTarget),
      tong_da_tich_luy: fmtVND(monthReport.savingsGoalsSummary.totalSaved),
      phan_tram_hoan_thanh: `${monthReport.savingsGoalsSummary.overallPercent}%`
    }
  };
}
