/**
 * Custom finance categories + groups (thu + chi).
 * Sort: usage frequency (desc) then manual sortOrder (asc).
 */

export type FinanceCatKind = "income" | "expense" | "both";

export interface FinanceCategoryGroup {
  id: string;
  name: string;
  emoji?: string;
  sortOrder: number;
}

export interface FinanceCategory {
  id: string;
  name: string;
  emoji: string;
  kind: FinanceCatKind;
  groupId?: string | null;
  sortOrder: number;
  isSystem?: boolean;
}

export interface FinanceCategoriesState {
  groups: FinanceCategoryGroup[];
  categories: FinanceCategory[];
}

/** Built-in expense codes kept for backward compatibility with existing txs. */
export const SYSTEM_EXPENSE_CATEGORIES: FinanceCategory[] = [
  { id: "food", name: "Ăn uống", emoji: "🍲", kind: "expense", sortOrder: 0, isSystem: true },
  { id: "education2", name: "Học tập", emoji: "📚", kind: "expense", sortOrder: 1, isSystem: true },
  { id: "utilities", name: "Điện nước", emoji: "⚡", kind: "expense", sortOrder: 2, isSystem: true },
  { id: "shopping", name: "Mua sắm", emoji: "🛍️", kind: "expense", sortOrder: 3, isSystem: true },
  { id: "medical", name: "Y tế", emoji: "💊", kind: "expense", sortOrder: 4, isSystem: true },
  { id: "transport", name: "Đi lại", emoji: "🚗", kind: "expense", sortOrder: 5, isSystem: true },
  { id: "debt_bank", name: "Trả nợ ngân hàng", emoji: "🏦", kind: "expense", sortOrder: 6, isSystem: true },
  { id: "debt_personal", name: "Trả nợ cá nhân", emoji: "🤝", kind: "expense", sortOrder: 7, isSystem: true },
  { id: "funeral", name: "Ma chay", emoji: "🌸", kind: "expense", sortOrder: 8, isSystem: true },
  { id: "ceremony", name: "Hiếu hỉ", emoji: "🎁", kind: "expense", sortOrder: 9, isSystem: true },
  { id: "other", name: "Khoản khác", emoji: "🏷️", kind: "expense", sortOrder: 10, isSystem: true }
];

export const SYSTEM_INCOME_CATEGORIES: FinanceCategory[] = [
  { id: "inc_salary", name: "Lương tháng", emoji: "💰", kind: "income", sortOrder: 0, isSystem: true },
  { id: "inc_bonus", name: "Tiền thưởng", emoji: "🎁", kind: "income", sortOrder: 1, isSystem: true },
  { id: "inc_freelance", name: "Làm thêm / Freelance", emoji: "💻", kind: "income", sortOrder: 2, isSystem: true },
  { id: "inc_invest", name: "Đầu tư / Cổ tức", emoji: "📈", kind: "income", sortOrder: 3, isSystem: true },
  { id: "inc_rent", name: "Cho thuê", emoji: "🏠", kind: "income", sortOrder: 4, isSystem: true },
  { id: "inc_gift", name: "Được cho / Biếu tặng", emoji: "🎀", kind: "income", sortOrder: 5, isSystem: true },
  { id: "inc_other", name: "Thu khác", emoji: "💵", kind: "income", sortOrder: 6, isSystem: true }
];

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategoriesState = {
  groups: [
    { id: "grp_sinhhoat", name: "Sinh hoạt", emoji: "🏠", sortOrder: 0 },
    { id: "grp_giaoduc", name: "Gia đình & Học", emoji: "👨‍👩‍👧", sortOrder: 1 },
    { id: "grp_taichinh", name: "Tài chính", emoji: "💳", sortOrder: 2 }
  ],
  categories: [
    ...SYSTEM_EXPENSE_CATEGORIES.map((c, i) => ({
      ...c,
      groupId: i < 4 ? "grp_sinhhoat" : i < 7 ? "grp_giaoduc" : "grp_taichinh"
    })),
    ...SYSTEM_INCOME_CATEGORIES
  ]
};

export function mergeFinanceCategories(raw?: Partial<FinanceCategoriesState> | null): FinanceCategoriesState {
  if (!raw || (!raw.categories?.length && !raw.groups?.length)) {
    return JSON.parse(JSON.stringify(DEFAULT_FINANCE_CATEGORIES));
  }
  const groups = Array.isArray(raw.groups) && raw.groups.length
    ? raw.groups
    : DEFAULT_FINANCE_CATEGORIES.groups;
  let categories = Array.isArray(raw.categories) ? [...raw.categories] : [];
  // Ensure system categories exist (legacy DBs)
  for (const sys of [...SYSTEM_EXPENSE_CATEGORIES, ...SYSTEM_INCOME_CATEGORIES]) {
    if (!categories.find(c => c.id === sys.id)) {
      categories.push({ ...sys });
    }
  }
  return { groups, categories };
}

/** Sort by usage count desc, then sortOrder, then name. */
export function sortCategoriesByPriority(
  cats: FinanceCategory[],
  usage: Record<string, number> = {}
): FinanceCategory[] {
  return [...cats].sort((a, b) => {
    const ua = usage[a.id] || usage[a.name] || 0;
    const ub = usage[b.id] || usage[b.name] || 0;
    if (ub !== ua) return ub - ua;
    const ao = a.sortOrder ?? 999;
    const bo = b.sortOrder ?? 999;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "vi");
  });
}

export function categoryLabel(cat: FinanceCategory): string {
  return `${cat.emoji || "🏷️"} ${cat.name}`;
}

/** Suggest amount with trailing zeros (3–6) + common mệnh giá. */
export function amountSuggestions(rawDigits: string): string[] {
  const digits = (rawDigits || "").replace(/\D/g, "");
  if (!digits) return ["10000", "50000", "100000", "200000", "500000", "1000000"];
  const out: string[] = [];
  for (const z of [3, 4, 5, 6]) {
    out.push(digits + "0".repeat(z));
  }
  // Also pad to common round numbers if short input
  if (digits.length <= 3) {
    out.push(digits + "000", digits + "0000");
  }
  return [...new Set(out)].slice(0, 6);
}
