/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Các hàm thuần về kỳ báo cáo (tháng/quý/năm) + tổng thu-chi + số dư ví.
// Tách khỏi Finance.tsx để test được logic tiền bạc độc lập với UI.

export type PeriodMode = "month" | "quarter" | "year";

export const PERIOD_LABELS: Record<PeriodMode, string> = { month: "Tháng", quarter: "Quý", year: "Năm" };

// Biên [đầu, cuối] của kỳ chứa `anchor` (theo giờ địa phương).
export function periodBounds(mode: PeriodMode, anchor: Date): { start: Date; end: Date } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  if (mode === "year") return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
  if (mode === "quarter") {
    const qs = Math.floor(m / 3) * 3;
    return { start: new Date(y, qs, 1), end: new Date(y, qs + 3, 0) };
  }
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
}

// YYYY-MM-DD theo giờ địa phương (khớp định dạng tx.date để so sánh chuỗi).
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Dời mốc sang kỳ liền trước/sau (dir = -1 / +1). Luôn ghim ngày = 1 và dựng
// Date qua constructor (y, m+offset, 1) để JS tự chuẩn hoá tràn tháng/năm,
// tránh lỗi tràn ngày của setMonth() khi anchor rơi vào ngày 29–31.
export function stepAnchor(mode: PeriodMode, anchor: Date, dir: number): Date {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  if (mode === "year") return new Date(y + dir, m, 1);
  if (mode === "quarter") return new Date(y, m + dir * 3, 1);
  return new Date(y, m + dir, 1);
}

export function periodLabel(mode: PeriodMode, anchor: Date): string {
  const y = anchor.getFullYear();
  if (mode === "year") return `Năm ${y}`;
  if (mode === "quarter") return `Quý ${Math.floor(anchor.getMonth() / 3) + 1}/${y}`;
  return `Tháng ${String(anchor.getMonth() + 1).padStart(2, "0")}/${y}`;
}

// Danh sách khóa "YYYY-MM" các tháng nằm trong kỳ (để gộp ngân sách theo tháng).
export function periodMonths(mode: PeriodMode, anchor: Date): string[] {
  const { start, end } = periodBounds(mode, anchor);
  const res: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return res;
}

// % thay đổi giữa kỳ này và kỳ trước (làm tròn).
export function pctDelta(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

// Tổng Thu/Chi/Cân đối của một tập giao dịch.
export interface TxLike { type: "income" | "expense"; amount: number; account?: string }

export function calcTotals(list: TxLike[]): { totalIncome: number; totalExpense: number; balance: number } {
  let totalIncome = 0;
  let totalExpense = 0;
  list.forEach(tx => {
    if (tx.type === "income") totalIncome += tx.amount;
    else totalExpense += tx.amount;
  });
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
}

// Số dư theo từng ví (tính từ giao dịch: thu cộng, chi trừ). Chưa có "số dư đầu kỳ".
export function accountBalances(transactions: TxLike[]): Record<string, number> {
  const bal: Record<string, number> = { cash: 0, bank: 0, e_wallet: 0 };
  transactions.forEach(tx => {
    const delta = tx.type === "income" ? tx.amount : -tx.amount;
    const key = tx.account || "cash";
    if (bal[key] === undefined) bal[key] = 0;
    bal[key] += delta;
  });
  return bal;
}
