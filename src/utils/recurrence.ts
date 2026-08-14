/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Logic mở rộng sự kiện LẶP LẠI thành các ngày diễn ra cụ thể — nguồn chân lý
// chung cho lịch tháng (Schedules) và "Sự kiện sắp diễn ra" (Dashboard).

export interface RecurringPlanLike {
  startDate: string;              // "YYYY-MM-DD" hoặc "YYYY-MM-DD HH:mm"
  endDate?: string;               // thời điểm kết thúc của LẦN diễn ra đầu tiên (legacy cũng là giới hạn lặp)
  isRecurring: boolean;
  recurrenceType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceWeekdays?: number[];  // 0=CN, 1=T2... (chỉ dùng cho weekly)
  /** Ngày cuối áp dụng chu kỳ. Chuỗi rỗng = lặp vô thời hạn. */
  recurrenceUntil?: string;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Parse phần ngày của "YYYY-MM-DD[ HH:mm]" theo giờ địa phương; null nếu hỏng. */
export function parsePlanDate(s: string | undefined): Date | null {
  const raw = String(s || "").slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Date tự tràn (ví dụ 31/02 → 03/03), nên cần kiểm tra lại đủ ba thành phần.
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

function recurrenceLast(plan: RecurringPlanLike, start: Date): Date | null {
  // Dữ liệu mới luôn lưu recurrenceUntil (kể cả chuỗi rỗng). Chuỗi rỗng nghĩa là lặp vô thời hạn.
  if (plan.recurrenceUntil !== undefined) {
    const explicit = parsePlanDate(plan.recurrenceUntil);
    if (!explicit) return null;
    return explicit < start ? start : explicit;
  }
  // Tương thích dữ liệu cũ: trước khi có recurrenceUntil, endDate đóng vai trò mốc dừng lặp.
  const legacy = parsePlanDate(plan.endDate || plan.startDate);
  if (!legacy || legacy < start) return start;
  return legacy;
}

function createExactDate(year: number, month: number, date: number): Date | null {
  const candidate = new Date(year, month, date);
  return candidate.getFullYear() === year && candidate.getMonth() === month && candidate.getDate() === date
    ? candidate
    : null;
}

/**
 * Liệt kê các ngày sự kiện lặp lại diễn ra trong [rangeStart, rangeEnd] (bao gồm 2 biên).
 * - daily: mọi ngày; weekly: đúng các thứ đã chọn (mặc định = thứ của ngày bắt đầu);
 *   monthly: đúng ngày-trong-tháng; yearly: đúng ngày/tháng (phù hợp sinh nhật).
 * - recurrenceUntil là ngày dừng lặp mới; với bản ghi cũ chưa có trường này, endDate vẫn được
 *   hiểu là giới hạn để không thay đổi hành vi lịch đã lưu trước đó.
 * - Ngày 29/02 chỉ xuất hiện vào năm nhuận, không tự dời sang 28/02 hoặc 01/03.
 */
export function expandRecurringOccurrences(
  plan: RecurringPlanLike,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (!plan.isRecurring || !plan.recurrenceType || plan.recurrenceType === "none") return [];
  const start = parsePlanDate(plan.startDate);
  if (!start) return [];

  const from = dayStart(new Date(Math.max(dayStart(rangeStart).getTime(), start.getTime())));
  const requestedTo = dayStart(rangeEnd);
  const last = recurrenceLast(plan, start);
  const to = last && last < requestedTo ? last : requestedTo;
  if (to < from) return [];

  const result: Date[] = [];
  const addIfVisible = (candidate: Date | null) => {
    if (candidate && candidate >= from && candidate <= to && candidate >= start) result.push(candidate);
  };

  if (plan.recurrenceType === "daily" || plan.recurrenceType === "weekly") {
    const weekdays = plan.recurrenceType === "weekly"
      ? ((plan.recurrenceWeekdays && plan.recurrenceWeekdays.length > 0) ? plan.recurrenceWeekdays : [start.getDay()])
      : [];
    const cursor = new Date(from);
    let guard = 0;
    while (cursor <= to && guard < 10_000) {
      if (plan.recurrenceType === "daily" || weekdays.includes(cursor.getDay())) result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return result;
  }

  if (plan.recurrenceType === "monthly") {
    const monthCursor = new Date(from.getFullYear(), from.getMonth(), 1);
    let guard = 0;
    while (monthCursor <= to && guard < 1_200) {
      addIfVisible(createExactDate(monthCursor.getFullYear(), monthCursor.getMonth(), start.getDate()));
      monthCursor.setMonth(monthCursor.getMonth() + 1);
      guard++;
    }
    return result;
  }

  if (plan.recurrenceType === "yearly") {
    let year = from.getFullYear();
    let guard = 0;
    while (year <= to.getFullYear() && guard < 200) {
      addIfVisible(createExactDate(year, start.getMonth(), start.getDate()));
      year++;
      guard++;
    }
  }

  return result;
}
