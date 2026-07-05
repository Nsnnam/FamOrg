/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Logic mở rộng sự kiện LẶP LẠI thành các ngày diễn ra cụ thể — nguồn chân lý
// chung cho lịch tháng (Schedules) và "Sự kiện sắp diễn ra" (Dashboard).
// Tách thuần để test được: bug "hằng tuần tô mọi ngày" (07/2026) nằm ở đây.

export interface RecurringPlanLike {
  startDate: string;              // "YYYY-MM-DD" hoặc "YYYY-MM-DD HH:mm"
  endDate?: string;               // ngày kết thúc khoảng áp dụng lặp lại
  isRecurring: boolean;
  recurrenceType?: "none" | "daily" | "weekly" | "monthly";
  recurrenceWeekdays?: number[];  // 0=CN, 1=T2... (chỉ dùng cho weekly)
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Parse phần ngày của "YYYY-MM-DD[ HH:mm]" theo giờ địa phương; null nếu hỏng. */
export function parsePlanDate(s: string | undefined): Date | null {
  const raw = String(s || "").slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Liệt kê các ngày sự kiện lặp lại diễn ra trong [rangeStart, rangeEnd] (bao gồm 2 biên).
 * - daily: mọi ngày; weekly: đúng các thứ đã chọn (mặc định = thứ của ngày bắt đầu);
 *   monthly: đúng ngày-trong-tháng của ngày bắt đầu.
 * - Chỉ trả ngày trong [startDate, endDate] của sự kiện (endDate < startDate coi như 1 ngày).
 * - Sự kiện không lặp (hoặc recurrenceType "none") trả mảng rỗng — caller tự xử lý.
 */
export function expandRecurringOccurrences(
  plan: RecurringPlanLike,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (!plan.isRecurring || !plan.recurrenceType || plan.recurrenceType === "none") return [];
  const start = parsePlanDate(plan.startDate);
  if (!start) return [];
  const endParsed = parsePlanDate(plan.endDate || plan.startDate);
  const last = !endParsed || endParsed < start ? start : endParsed;

  const from = dayStart(new Date(Math.max(dayStart(rangeStart).getTime(), start.getTime())));
  const to = dayStart(rangeEnd);
  const result: Date[] = [];
  const cursor = new Date(from);
  let guard = 0;
  while (cursor <= to && cursor <= last && guard < 400) {
    let matches = false;
    if (plan.recurrenceType === "daily") matches = true;
    else if (plan.recurrenceType === "weekly") {
      const weekdays = (plan.recurrenceWeekdays && plan.recurrenceWeekdays.length > 0)
        ? plan.recurrenceWeekdays
        : [start.getDay()];
      matches = weekdays.includes(cursor.getDay());
    } else if (plan.recurrenceType === "monthly") {
      matches = cursor.getDate() === start.getDate();
    }
    if (matches) result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return result;
}
