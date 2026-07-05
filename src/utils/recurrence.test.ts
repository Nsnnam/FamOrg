/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { expandRecurringOccurrences, parsePlanDate, RecurringPlanLike } from "./recurrence.js";

const d = (s: string) => new Date(`${s}T00:00:00`);
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const expand = (plan: Partial<RecurringPlanLike>, from: string, to: string) =>
  expandRecurringOccurrences(
    { isRecurring: true, startDate: "2026-07-01", ...plan } as RecurringPlanLike,
    d(from), d(to)
  ).map(iso);

describe("parsePlanDate", () => {
  it("parse ngày thuần và ngày kèm giờ", () => {
    expect(iso(parsePlanDate("2026-07-05")!)).toBe("2026-07-05");
    expect(iso(parsePlanDate("2026-07-05 14:30")!)).toBe("2026-07-05");
  });
  it("trả null cho chuỗi hỏng", () => {
    expect(parsePlanDate("")).toBeNull();
    expect(parsePlanDate("khong-phai-ngay")).toBeNull();
    expect(parsePlanDate(undefined)).toBeNull();
  });
});

describe("expandRecurringOccurrences — hằng tuần (bug 07/2026: tô mọi ngày)", () => {
  // Sự kiện lặp T7+CN trong 2 tuần: chỉ đúng 4 ngày cuối tuần, KHÔNG tràn cả khoảng.
  it("chỉ trả đúng các thứ đã chọn, không tràn mọi ngày trong khoảng", () => {
    const out = expand(
      { startDate: "2026-07-01", endDate: "2026-07-14", recurrenceType: "weekly", recurrenceWeekdays: [6, 0] },
      "2026-07-01", "2026-07-31"
    );
    // 4/7 (T7), 5/7 (CN), 11/7 (T7), 12/7 (CN) — dừng ở endDate 14/7
    expect(out).toEqual(["2026-07-04", "2026-07-05", "2026-07-11", "2026-07-12"]);
  });

  it("không chọn thứ nào → mặc định thứ của ngày bắt đầu", () => {
    // 2026-07-01 là Thứ Tư
    const out = expand(
      { startDate: "2026-07-01", endDate: "2026-07-31", recurrenceType: "weekly", recurrenceWeekdays: [] },
      "2026-07-01", "2026-07-31"
    );
    expect(out).toEqual(["2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29"]);
  });

  it("tôn trọng endDate: không sinh occurrence sau ngày kết thúc", () => {
    const out = expand(
      { startDate: "2026-07-01", endDate: "2026-07-05", recurrenceType: "weekly", recurrenceWeekdays: [0] },
      "2026-07-01", "2026-08-31"
    );
    expect(out).toEqual(["2026-07-05"]); // CN duy nhất trước 5/7
  });
});

describe("expandRecurringOccurrences — hằng ngày", () => {
  it("mọi ngày trong giao của [start,end] sự kiện và khoảng xem", () => {
    const out = expand(
      { startDate: "2026-07-03", endDate: "2026-07-06", recurrenceType: "daily" },
      "2026-07-01", "2026-07-31"
    );
    expect(out).toEqual(["2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06"]);
  });

  it("khoảng xem bắt đầu giữa chừng → cắt phần trước", () => {
    const out = expand(
      { startDate: "2026-07-01", endDate: "2026-07-10", recurrenceType: "daily" },
      "2026-07-08", "2026-07-31"
    );
    expect(out).toEqual(["2026-07-08", "2026-07-09", "2026-07-10"]);
  });
});

describe("expandRecurringOccurrences — hằng tháng", () => {
  it("đúng ngày-trong-tháng của ngày bắt đầu, qua nhiều tháng", () => {
    const out = expand(
      { startDate: "2026-01-15", endDate: "2026-12-31", recurrenceType: "monthly" },
      "2026-07-01", "2026-09-30"
    );
    expect(out).toEqual(["2026-07-15", "2026-08-15", "2026-09-15"]);
  });

  it("ngày 31 → bỏ qua tháng thiếu (không nhảy sang mùng 1)", () => {
    const out = expand(
      { startDate: "2026-01-31", endDate: "2026-12-31", recurrenceType: "monthly" },
      "2026-02-01", "2026-04-30"
    );
    // Tháng 2 và 4 không có ngày 31 → chỉ 31/3
    expect(out).toEqual(["2026-03-31"]);
  });
});

describe("expandRecurringOccurrences — biên & dữ liệu xấu", () => {
  it("không lặp / recurrenceType none → mảng rỗng", () => {
    expect(expand({ recurrenceType: "none" }, "2026-07-01", "2026-07-31")).toEqual([]);
    expect(
      expandRecurringOccurrences(
        { isRecurring: false, startDate: "2026-07-01", recurrenceType: "daily" },
        d("2026-07-01"), d("2026-07-31")
      )
    ).toEqual([]);
  });

  it("startDate hỏng → mảng rỗng, không crash", () => {
    expect(expand({ startDate: "xxx", recurrenceType: "daily" }, "2026-07-01", "2026-07-31")).toEqual([]);
  });

  it("endDate < startDate → coi như sự kiện 1 ngày", () => {
    const out = expand(
      { startDate: "2026-07-10", endDate: "2026-07-01", recurrenceType: "daily" },
      "2026-07-01", "2026-07-31"
    );
    expect(out).toEqual(["2026-07-10"]);
  });

  it("sự kiện bắt đầu sau khoảng xem → rỗng", () => {
    const out = expand(
      { startDate: "2026-09-01", endDate: "2026-09-30", recurrenceType: "daily" },
      "2026-07-01", "2026-07-31"
    );
    expect(out).toEqual([]);
  });
});
