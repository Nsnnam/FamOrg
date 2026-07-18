/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import {
  periodBounds, toDateStr, stepAnchor, periodLabel, periodMonths,
  pctDelta, calcTotals, accountBalances, monthlySeries, TxLike
} from "./financePeriod.js";

const d = (s: string) => new Date(`${s}T00:00:00`);

describe("periodBounds", () => {
  it("tháng: mùng 1 → ngày cuối tháng (kể cả tháng 2 nhuận)", () => {
    const { start, end } = periodBounds("month", d("2024-02-10"));
    expect(toDateStr(start)).toBe("2024-02-01");
    expect(toDateStr(end)).toBe("2024-02-29"); // 2024 nhuận
  });
  it("quý: Q3 = 1/7 → 30/9", () => {
    const { start, end } = periodBounds("quarter", d("2026-08-15"));
    expect(toDateStr(start)).toBe("2026-07-01");
    expect(toDateStr(end)).toBe("2026-09-30");
  });
  it("năm: 1/1 → 31/12", () => {
    const { start, end } = periodBounds("year", d("2026-06-30"));
    expect(toDateStr(start)).toBe("2026-01-01");
    expect(toDateStr(end)).toBe("2026-12-31");
  });
});

describe("stepAnchor — không tràn tháng khi anchor ngày 29-31", () => {
  it("lùi 1 tháng từ 31/7 → tháng 6 (không nhảy cóc)", () => {
    const prev = stepAnchor("month", d("2026-07-31"), -1);
    expect(prev.getMonth()).toBe(5); // June
  });
  it("tiến 1 tháng từ 31/1 → tháng 2 (không nhảy sang tháng 3)", () => {
    const next = stepAnchor("month", d("2026-01-31"), 1);
    expect(next.getMonth()).toBe(1); // February
  });
  it("quý/năm dời đúng", () => {
    expect(stepAnchor("quarter", d("2026-01-15"), -1).getFullYear()).toBe(2025);
    expect(stepAnchor("year", d("2026-05-01"), 1).getFullYear()).toBe(2027);
  });
});

describe("periodMonths & periodLabel", () => {
  it("quý ra đúng 3 khóa tháng", () => {
    expect(periodMonths("quarter", d("2026-08-15"))).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
  it("năm ra 12 khóa", () => {
    expect(periodMonths("year", d("2026-03-01"))).toHaveLength(12);
  });
  it("nhãn tiếng Việt đúng", () => {
    expect(periodLabel("month", d("2026-07-05"))).toBe("Tháng 07/2026");
    expect(periodLabel("quarter", d("2026-07-05"))).toBe("Quý 3/2026");
    expect(periodLabel("year", d("2026-07-05"))).toBe("Năm 2026");
  });
});

describe("pctDelta", () => {
  it("tính % thay đổi thường", () => {
    expect(pctDelta(150, 100)).toBe(50);
    expect(pctDelta(50, 100)).toBe(-50);
  });
  it("kỳ trước = 0: cur 0 → 0%, cur > 0 → 100%", () => {
    expect(pctDelta(0, 0)).toBe(0);
    expect(pctDelta(500, 0)).toBe(100);
  });
  it("kỳ trước âm dùng trị tuyệt đối, không đảo dấu", () => {
    expect(pctDelta(-50, -100)).toBe(50); // bớt âm = cải thiện +50%
  });
});

describe("calcTotals", () => {
  const txs: TxLike[] = [
    { type: "income", amount: 10_000_000 },
    { type: "income", amount: 2_000_000 },
    { type: "expense", amount: 3_500_000 },
    { type: "expense", amount: 500_000 }
  ];
  it("cộng đúng thu / chi / cân đối", () => {
    expect(calcTotals(txs)).toEqual({ totalIncome: 12_000_000, totalExpense: 4_000_000, balance: 8_000_000 });
  });
  it("danh sách rỗng → toàn 0", () => {
    expect(calcTotals([])).toEqual({ totalIncome: 0, totalExpense: 0, balance: 0 });
  });
});

describe("monthlySeries — chuỗi thu/chi 12 tháng cho biểu đồ", () => {
  const anchor = d("2026-07-18");
  it("ra đúng N tháng liền mạch kết thúc ở tháng hiện tại, tháng trống = 0", () => {
    const pts = monthlySeries([], 12, anchor);
    expect(pts).toHaveLength(12);
    expect(pts[0].key).toBe("2025-08");
    expect(pts[11].key).toBe("2026-07");
    expect(pts.every(p => p.income === 0 && p.expense === 0)).toBe(true);
  });
  it("cộng dồn đúng tháng, bỏ qua giao dịch ngoài khoảng", () => {
    const pts = monthlySeries([
      { date: "2026-07-01", type: "income", amount: 5_000_000 },
      { date: "2026-07-15", type: "expense", amount: 1_000_000 },
      { date: "2026-06-30", type: "expense", amount: 700_000 },
      { date: "2024-01-01", type: "income", amount: 999 } // quá cũ — ngoài 12 tháng
    ], 12, anchor);
    const jul = pts.find(p => p.key === "2026-07")!;
    const jun = pts.find(p => p.key === "2026-06")!;
    expect(jul.income).toBe(5_000_000);
    expect(jul.expense).toBe(1_000_000);
    expect(jun.expense).toBe(700_000);
    expect(pts.reduce((s, p) => s + p.income, 0)).toBe(5_000_000); // 999 bị bỏ
  });
  it("nhãn: tháng thường T7, tháng 1 kèm năm để đánh dấu sang năm mới", () => {
    const pts = monthlySeries([], 12, anchor);
    expect(pts.find(p => p.key === "2026-01")!.label).toBe("T1/26");
    expect(pts.find(p => p.key === "2025-12")!.label).toBe("T12");
  });
});

describe("accountBalances — số dư từng ví", () => {
  it("thu cộng, chi trừ, đúng ví", () => {
    const bal = accountBalances([
      { type: "income", amount: 5_000_000, account: "bank" },
      { type: "expense", amount: 1_200_000, account: "bank" },
      { type: "income", amount: 300_000, account: "cash" },
      { type: "expense", amount: 100_000, account: "e_wallet" }
    ]);
    expect(bal.bank).toBe(3_800_000);
    expect(bal.cash).toBe(300_000);
    expect(bal.e_wallet).toBe(-100_000);
  });
  it("luôn có đủ 3 ví mặc định kể cả khi chưa có giao dịch", () => {
    expect(accountBalances([])).toEqual({ cash: 0, bank: 0, e_wallet: 0 });
  });
  it("ví lạ (dữ liệu cũ) không crash, vẫn cộng dồn riêng", () => {
    const bal = accountBalances([{ type: "income", amount: 99, account: "vi_la" }]);
    expect(bal.vi_la).toBe(99);
  });
});
