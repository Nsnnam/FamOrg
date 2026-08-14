/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountType, FinancialTransaction, TransactionType } from "../src/types.js";

const MAX_ROWS = 5_000;
const MAX_DESCRIPTION = 500;
const MAX_RECEIPT_REF = 2_000;

export interface FinanceImportPayload {
  transactions?: unknown;
  categories?: unknown;
}

export interface FinanceImportRow extends Partial<FinancialTransaction> {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  account: AccountType;
  description: string;
  date: string;
  receiptImage?: string;
  createdAt?: string;
}

export interface FinanceImportIssue {
  row: number;
  message: string;
}

export interface FinanceImportPreview {
  sourceCount: number;
  validRows: FinanceImportRow[];
  issues: FinanceImportIssue[];
  duplicateIds: string[];
  skippedExisting: number;
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Parse at UTC midnight so validation is independent of the NAS/container TZ.
  // Parsing local midnight and comparing toISOString() rejects every date in
  // positive offsets (for example Asia/Ho_Chi_Minh), because it serializes to
  // the previous UTC calendar day.
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function normalizeCategory(sourceType: TransactionType, sourceName: unknown): string {
  const name = normalizeText(sourceName);
  if (sourceType === TransactionType.INCOME) {
    if (name.includes("luong")) return "inc_salary";
    if (name.includes("thuong")) return "inc_bonus";
    if (name.includes("freelance") || name.includes("lam them")) return "inc_freelance";
    if (name.includes("dau tu") || name.includes("lai suat") || name.includes("co tuc")) return "inc_invest";
    if (name.includes("cho thue")) return "inc_rent";
    if (name.includes("duoc cho") || name.includes("bieu tang") || name.includes("qua tang")) return "inc_gift";
    return "inc_other";
  }
  if (name.includes("an uong")) return "food";
  if (name.includes("hoc") || name.includes("hoc phi")) return "education2";
  if (name.includes("dien nuoc") || name === "dien" || name === "nuoc") return "utilities";
  if (name.includes("mua sam")) return "shopping";
  if (name.includes("y te") || name.includes("suc khoe")) return "medical";
  if (name.includes("di chuyen") || name.includes("di lai") || name.includes("xang")) return "transport";
  if (name.includes("tra no") && name.includes("ca nhan")) return "debt_personal";
  if (name.includes("tra no") || name.includes("vay")) return "debt_bank";
  if (name.includes("ma chay")) return "funeral";
  if (name.includes("hieu hi") || name.includes("sinh nhat") || name.includes("cuoi")) return "ceremony";
  return "other";
}

function sourceCategoryName(raw: any, categoryById: Map<string, string>): string {
  const sourceId = typeof raw.categoryId === "string" ? raw.categoryId : "";
  if (sourceId && categoryById.has(sourceId)) return categoryById.get(sourceId)!;
  return typeof raw.category === "string" ? raw.category : "";
}

function receiptReference(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const ref = value.trim();
  if (ref.length > MAX_RECEIPT_REF) return undefined;
  if (/^https?:\/\//i.test(ref) || ref.startsWith("/uploads/") || ref.startsWith("data:image/")) {
    return ref;
  }
  return undefined;
}

/**
 * Chuẩn hóa backup JSON thành bản ghi FamOrg. Hàm không ghi dữ liệu và dùng được
 * cho cả preview lẫn bước import thật để kết quả người dùng xem trước luôn khớp.
 */
export function previewFinanceImport(payload: FinanceImportPayload, existingIds = new Set<string>()): FinanceImportPreview {
  const rawTransactions = Array.isArray(payload?.transactions) ? payload.transactions : [];
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const categoryById = new Map<string, string>();
  for (const category of categories) {
    if (category && typeof category === "object") {
      const item = category as any;
      if (typeof item.id === "string" && typeof item.name === "string") categoryById.set(item.id, item.name);
    }
  }

  const issues: FinanceImportIssue[] = [];
  const validRows: FinanceImportRow[] = [];
  const duplicateIds: string[] = [];
  const seenIds = new Set<string>();
  const sourceCount = rawTransactions.length;

  if (sourceCount > MAX_ROWS) {
    return {
      sourceCount,
      validRows: [],
      issues: [{ row: 0, message: `File vượt quá giới hạn ${MAX_ROWS.toLocaleString("vi-VN")} giao dịch.` }],
      duplicateIds: [],
      skippedExisting: 0
    };
  }

  rawTransactions.forEach((raw, index) => {
    const rowNumber = index + 1;
    if (!raw || typeof raw !== "object") {
      issues.push({ row: rowNumber, message: "Dòng không phải là một đối tượng JSON." });
      return;
    }
    const item = raw as any;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const type = item.type === TransactionType.INCOME || item.type === TransactionType.EXPENSE ? item.type : null;
    const amount = typeof item.amount === "number" ? item.amount : Number(item.amount);
    const date = typeof item.date === "string" ? item.date.slice(0, 10) : "";

    if (!id || id.length > 120) {
      issues.push({ row: rowNumber, message: "Thiếu ID hoặc ID dài không hợp lệ." });
      return;
    }
    if (!type) {
      issues.push({ row: rowNumber, message: "Loại giao dịch phải là income hoặc expense." });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
      issues.push({ row: rowNumber, message: "Số tiền không hợp lệ hoặc vượt giới hạn." });
      return;
    }
    if (!validDate(date)) {
      issues.push({ row: rowNumber, message: "Ngày phải có dạng YYYY-MM-DD hợp lệ." });
      return;
    }
    if (seenIds.has(id)) {
      duplicateIds.push(id);
      issues.push({ row: rowNumber, message: `ID ${id} xuất hiện nhiều lần trong file.` });
      return;
    }
    seenIds.add(id);
    if (existingIds.has(id)) {
      duplicateIds.push(id);
      return;
    }

    const rawDescription = typeof item.note === "string" ? item.note : typeof item.description === "string" ? item.description : "";
    const description = rawDescription.trim().slice(0, MAX_DESCRIPTION) || "Giao dịch nhập khẩu";
    const createdAt = typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt))
      ? item.createdAt
      : undefined;
    const receiptImage = receiptReference(item.receiptImage);
    const sourceName = sourceCategoryName(item, categoryById);

    validRows.push({
      id,
      type,
      amount: Math.round(amount),
      category: normalizeCategory(type, sourceName),
      account: AccountType.BANK,
      description,
      date,
      receiptImage,
      createdAt
    });
  });

  return {
    sourceCount,
    validRows,
    issues,
    duplicateIds,
    skippedExisting: duplicateIds.filter(id => existingIds.has(id)).length
  };
}
