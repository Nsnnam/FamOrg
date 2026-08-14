/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { AccountType, TransactionType } from "../src/types.js";
import { previewFinanceImport } from "./financeImport.js";

describe("previewFinanceImport", () => {
  it("ánh xạ backup FamOrg theo tên danh mục và giữ ghi chú/biên lai hợp lệ", () => {
    const result = previewFinanceImport({
      categories: [{ id: "cat_food", name: "Ăn uống" }],
      transactions: [{
        id: "source-1",
        type: "expense",
        amount: 30000,
        categoryId: "cat_food",
        date: "2026-08-14",
        note: "Xôi sáng",
        receiptImage: "https://example.com/receipt.jpg"
      }]
    });

    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      id: "source-1",
      type: TransactionType.EXPENSE,
      amount: 30000,
      category: "food",
      account: AccountType.BANK,
      description: "Xôi sáng",
      date: "2026-08-14",
      receiptImage: "https://example.com/receipt.jpg"
    });
    expect(result.issues).toHaveLength(0);
  });

  it("ánh xạ các danh mục thu phổ biến về mã hệ thống", () => {
    const result = previewFinanceImport({
      transactions: [
        { id: "income-1", type: "income", amount: 12000000, category: "Lương", date: "2026-08-01", note: "Lương tháng" },
        { id: "income-2", type: "income", amount: 500000, category: "Lãi suất", date: "2026-08-02", note: "Lãi" }
      ]
    });
    expect(result.validRows.map(row => row.category)).toEqual(["inc_salary", "inc_invest"]);
  });

  it("bỏ qua ID đã tồn tại để import có thể chạy lặp an toàn", () => {
    const result = previewFinanceImport({
      transactions: [
        { id: "existing", type: "expense", amount: 1000, category: "Ăn uống", date: "2026-08-01" },
        { id: "new", type: "expense", amount: 2000, category: "Mua sắm", date: "2026-08-02" }
      ]
    }, new Set(["existing"]));
    expect(result.validRows.map(row => row.id)).toEqual(["new"]);
    expect(result.skippedExisting).toBe(1);
    expect(result.duplicateIds).toContain("existing");
  });

  it("báo lỗi dòng hỏng nhưng vẫn cho phép nhập các dòng hợp lệ", () => {
    const result = previewFinanceImport({
      transactions: [
        { id: "ok", type: "expense", amount: 1000, category: "Ăn uống", date: "2026-08-01" },
        { id: "bad", type: "expense", amount: -1, category: "Ăn uống", date: "2026-08-01" },
        { id: "bad-date", type: "expense", amount: 1000, category: "Ăn uống", date: "01/08/2026" }
      ]
    });
    expect(result.validRows.map(row => row.id)).toEqual(["ok"]);
    expect(result.issues).toHaveLength(2);
  });

  it("không giữ tham chiếu biên lai không an toàn", () => {
    const result = previewFinanceImport({
      transactions: [{ id: "receipt-1", type: "expense", amount: 1000, category: "Khác", date: "2026-08-01", receiptImage: "javascript:alert(1)" }]
    });
    expect(result.validRows[0].receiptImage).toBeUndefined();
  });
});
