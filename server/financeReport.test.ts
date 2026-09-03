import { describe, it, expect, vi } from "vitest";

const mockDb = {
  transactions: [
    {
      id: "tx_1",
      type: "income",
      category: "salary",
      amount: 25000000,
      date: "2026-09-01",
      description: "Lương tháng 9",
      accountId: "acc_1",
      createdAt: "2026-09-01T08:00:00Z"
    },
    {
      id: "tx_2",
      type: "expense",
      category: "food",
      amount: 3500000,
      date: "2026-09-02",
      description: "Đi siêu thị",
      accountId: "acc_1",
      createdAt: "2026-09-02T10:00:00Z"
    },
    {
      id: "tx_3",
      type: "expense",
      category: "utilities",
      amount: 1500000,
      date: "2026-09-03",
      description: "Tiền điện nước",
      accountId: "acc_1",
      createdAt: "2026-09-03T14:00:00Z"
    }
  ],
  budgets: [
    {
      id: "bg_1",
      category: "food",
      limit: 5000000,
      month: "2026-09"
    },
    {
      id: "bg_2",
      category: "utilities",
      limit: 1000000,
      month: "2026-09"
    }
  ],
  debts: [],
  savingGoals: [],
  users: [{ id: "u_1", fullName: "Ba" }]
};

vi.mock("./db.js", () => ({
  FamilyDB: {
    readRaw: () => mockDb,
    getBudgets: () => mockDb.budgets,
    getTransactions: () => mockDb.transactions,
    getDebts: () => mockDb.debts,
    getSavingGoals: () => mockDb.savingGoals
  },
  getAppSettings: () => ({}),
  setAppSetting: () => {}
}));

import { getFinancialReport, getComprehensiveFinancialContextForAI } from "./financeReport.js";

describe("financeReport engine", () => {
  it("calculates accurate daily report", () => {
    const anchor = new Date("2026-09-03T15:00:00+07:00");
    const rep = getFinancialReport("day", anchor);
    expect(rep.period).toBe("day");
    expect(rep.totalExpense).toBe(1500000);
    expect(rep.totalIncome).toBe(0);
    expect(rep.balance).toBe(-1500000);
  });

  it("calculates accurate monthly report with budget limit warnings", () => {
    const anchor = new Date("2026-09-03T15:00:00+07:00");
    const rep = getFinancialReport("month", anchor);
    expect(rep.period).toBe("month");
    expect(rep.totalIncome).toBe(25000000);
    expect(rep.totalExpense).toBe(5000000); // 3.5m + 1.5m
    expect(rep.balance).toBe(20000000);

    // Budgets
    expect(rep.budgets.hasBudgets).toBe(true);
    expect(rep.budgets.totalLimit).toBe(6000000);
    expect(rep.budgets.totalSpentInBudgeted).toBe(5000000);
    expect(rep.budgets.isOverBudget).toBe(true); // utilities is 1.5m vs 1.0m limit

    const utilitiesBudget = rep.budgets.items.find(b => b.category === "utilities");
    expect(utilitiesBudget).toBeDefined();
    expect(utilitiesBudget?.status).toBe("exceeded");
    expect(utilitiesBudget?.usedPercent).toBe(150);
  });

  it("generates comprehensive AI financial context", () => {
    const anchor = new Date("2026-09-03T15:00:00+07:00");
    const ctx = getComprehensiveFinancialContextForAI(anchor);
    expect(ctx.thoi_gian_hien_tai_vietnam.ngay_chuan_iso).toBe("2026-09-03");
    expect(ctx.thang_nay.tong_thu).toBe(25000000);
    expect(ctx.thang_nay.tong_chi).toBe(5000000);
    expect(ctx.thang_nay.chi_tieu_ngan_sach.co_chi_tieu).toBe(true);
    expect(ctx.thang_nay.chi_tieu_ngan_sach.cac_muc_vuot_chi_tieu.length).toBeGreaterThan(0);
  });
});
