/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { debtPaid, debtRemaining, isDebtFullyPaid, DebtLike } from "./debt.js";

const debt = (amount: number, ...paymentAmounts: number[]): DebtLike => ({
  amount,
  payments: paymentAmounts.map(a => ({ amount: a }))
});

describe("debtPaid — tổng đã trả", () => {
  it("cộng dồn các khoản trả", () => {
    expect(debtPaid(debt(10_000_000, 3_000_000, 2_000_000))).toBe(5_000_000);
  });
  it("chưa trả gì → 0", () => {
    expect(debtPaid(debt(10_000_000))).toBe(0);
  });
});

describe("debtRemaining — còn phải trả", () => {
  it("nợ gốc trừ đã trả", () => {
    expect(debtRemaining(debt(10_000_000, 4_000_000))).toBe(6_000_000);
  });
  it("trả DƯ không ra số âm (giữ 0)", () => {
    expect(debtRemaining(debt(5_000_000, 3_000_000, 3_000_000))).toBe(0);
  });
});

describe("isDebtFullyPaid — luật tự tất toán / mở lại", () => {
  it("trả đủ CHÍNH XÁC nợ gốc → tất toán", () => {
    expect(isDebtFullyPaid(debt(7_000_000, 5_000_000, 2_000_000))).toBe(true);
  });
  it("trả dư → vẫn tất toán", () => {
    expect(isDebtFullyPaid(debt(7_000_000, 8_000_000))).toBe(true);
  });
  it("thiếu 1 đồng → CHƯA tất toán", () => {
    expect(isDebtFullyPaid(debt(7_000_000, 6_999_999))).toBe(false);
  });
  it("xóa một khoản trả làm tụt dưới nợ gốc → mở lại (server dựa vào hàm này)", () => {
    const d = debt(10_000_000, 6_000_000, 4_000_000);
    expect(isDebtFullyPaid(d)).toBe(true);       // đang tất toán
    d.payments = d.payments.slice(0, 1);          // xóa khoản 4tr
    expect(isDebtFullyPaid(d)).toBe(false);       // phải mở lại
  });
  it("nợ 0 đồng (dữ liệu biên) coi như đã đủ", () => {
    expect(isDebtFullyPaid(debt(0))).toBe(true);
  });
});
