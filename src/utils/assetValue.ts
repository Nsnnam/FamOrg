/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Logic định giá tài sản (thuần, không phụ thuộc React) — tách riêng để unit test.
 */

import { AssetType, FamilyAsset } from "../types.js";

export function isGoldType(type: AssetType): boolean {
  return type === "gold_bar" || type === "gold_ring" || type === "gold_jewelry" || type === "gold_other";
}

export interface MarketPrices {
  gold: {
    pricePerGramUsd: number;
    pricePerGramVnd: number;
    pricePerChiUsd: number;
    pricePerChiVnd: number;
    pricePerLuongUsd: number;
    pricePerLuongVnd: number;
    source: string;
  } | null;
  crypto: Record<string, { usd: number; vnd: number }>;
  usdVndRate: number;
  lastUpdated: string;
}

/**
 * Bảng quy ước hệ số giá theo tuổi vàng — tham chiếu giá vàng SJC 9999 (miếng).
 *
 * Vàng tuổi thấp khi quy đổi/bán lại chỉ thu về xấp xỉ (hàm lượng vàng × giá vàng ròng),
 * đã trừ hao tuổi vàng và chênh lệch thu mua của tiệm. Đây là ước lượng TƯƠNG ĐỐI, rút ra
 * từ khảo sát thị trường (06/2026, vàng 9999 ~14.7tr/chỉ):
 *   - 18K bán ~11tr/chỉ  → ~0.72 giá 9999  (hàm lượng lý thuyết 75%)
 *   - 14K bán ~8.3tr/chỉ → ~0.53 giá 9999  (hàm lượng lý thuyết 58.5%)
 *   - 10K bán ~5.8tr/chỉ → ~0.38 giá 9999  (hàm lượng lý thuyết 41.6%)
 * Vàng tuổi cao (≥98%) gần như theo đúng hàm lượng; tuổi thấp bị trừ thêm hao công.
 */
export const GOLD_PURITY_OPTIONS: { value: string; label: string; content: string; factor: number }[] = [
  { value: "9999", label: "Vàng 9999 / 24K (vàng ròng)", content: "99.99%", factor: 1.0 },
  { value: "999",  label: "Vàng 999 / 23.5K",            content: "99.9%",  factor: 0.98 },
  { value: "980",  label: "Vàng 980 / 23K (vàng ta)",    content: "98%",    factor: 0.95 },
  { value: "950",  label: "Vàng 950 / 22.8K",            content: "95%",    factor: 0.92 },
  { value: "750",  label: "Vàng 750 / 18K",              content: "75%",    factor: 0.72 },
  { value: "680",  label: "Vàng 680 / 16K",              content: "68%",    factor: 0.64 },
  { value: "610",  label: "Vàng 610 / 14.6K",            content: "61%",    factor: 0.56 },
  { value: "585",  label: "Vàng 585 / 14K",              content: "58.5%",  factor: 0.53 },
  { value: "416",  label: "Vàng 416 / 10K",              content: "41.6%",  factor: 0.38 }
];

// Chuẩn hoá chuỗi tuổi vàng người dùng nhập về một mã trong GOLD_PURITY_OPTIONS.
// Hỗ trợ cả cách ghi Karat ("18k") lẫn phần nghìn ("750").
export function normalizeGoldPurity(purity?: string): string {
  if (!purity) return "";
  const p = purity.trim().toLowerCase().replace(/\s/g, "");
  if (GOLD_PURITY_OPTIONS.some(o => o.value === p)) return p;
  const karatMap: Record<string, string> = {
    "24k": "9999", "23.5k": "999", "23k": "980", "22k": "950",
    "18k": "750", "16k": "680", "14.6k": "610", "14k": "585", "10k": "416"
  };
  if (karatMap[p]) return karatMap[p];
  if (p === "99.99" || p === "24") return "9999";
  if (p === "583") return "585";
  if (p === "417") return "416";
  return "";
}

// Hệ số nhân với giá vàng SJC 9999 để ước lượng giá trị theo tuổi vàng.
export function goldPurityFactor(purity?: string): number {
  if (!purity) return 1;
  const code = normalizeGoldPurity(purity);
  const opt = GOLD_PURITY_OPTIONS.find(o => o.value === code);
  if (opt) return opt.factor;
  // Tự suy hệ số khi gặp chuỗi lạ không có trong bảng (dữ liệu cũ nhập tay).
  const p = purity.trim().toLowerCase().replace(/\s/g, "");
  const km = p.match(/^(\d{1,2}(?:\.\d+)?)k$/);
  if (km) return Math.min(1, Number(km[1]) / 24);       // Karat: "18k" → 0.75
  const n = Number(p);
  if (Number.isFinite(n) && n > 0) {
    if (n <= 24) return n / 24;                          // Karat: "22" → 0.917
    if (n < 100) return n / 100;                         // phần trăm: "75" → 0.75, "98" → 0.98
    if (n <= 1000) return n / 1000;                      // phần nghìn: "750" → 0.75, "980" → 0.98
    if (n <= 9999) return Math.min(1, n / 10000);        // phần vạn: "9999" → 0.9999
  }
  return 1;
}

// Nhãn hiển thị tuổi vàng (đẹp hơn mã thô như "750"); fallback giữ nguyên giá trị đã lưu.
export function goldPurityLabel(purity?: string): string {
  if (!purity) return "—";
  const opt = GOLD_PURITY_OPTIONS.find(o => o.value === normalizeGoldPurity(purity));
  return opt ? opt.label : purity;
}

// Trọng lượng vàng hiệu dụng: dùng quantity (đã gộp), fallback field weight cũ.
export function effectiveGoldWeight(asset: Pick<FamilyAsset, "weight" | "quantity">): number {
  return (asset.weight && asset.weight > 0) ? asset.weight : Number(asset.quantity || 0);
}

export interface EffectiveValue {
  value: number;
  source: "manual" | "live" | "purchase" | "none";
}

export interface ProfitLossResult {
  profitLoss: number | null;
  profitLossPct: number | null;
}

/** Tính chênh lệch tuyệt đối và phần trăm; trả null khi chưa có giá mua hợp lệ. */
export function calculateProfitLoss(currentValue: number, purchaseValue: number): ProfitLossResult {
  const current = Number(currentValue);
  const purchase = Number(purchaseValue);
  if (!Number.isFinite(current) || !Number.isFinite(purchase) || purchase <= 0) {
    return { profitLoss: null, profitLossPct: null };
  }
  const profitLoss = current - purchase;
  return { profitLoss, profitLossPct: (profitLoss / purchase) * 100 };
}

/**
 * Lấy đơn vị giá thị trường theo 1 đơn vị của tài sản (đã nhân hệ số tuổi vàng hoặc tỷ giá USD/VND).
 * Áp dụng cho các loại có giá live như Vàng (theo chỉ, lượng, cây, gram, phân) và Crypto (theo coin).
 */
export function getMarketUnitPrice(
  assetOrConfig: {
    type: AssetType;
    unit?: string;
    weightUnit?: string;
    goldPurity?: string;
    symbol?: string;
    currency?: "VND" | "USD";
  },
  marketPrices: MarketPrices | null
): number {
  if (!marketPrices) return 0;
  const isUsd = assetOrConfig.currency === "USD";
  if (isGoldType(assetOrConfig.type)) {
    const gold = marketPrices.gold;
    if (!gold) return 0;
    const wu = (assetOrConfig.weightUnit || assetOrConfig.unit || "chỉ").toLowerCase().trim();
    let ppu: number;
    if (wu === "lượng" || wu === "cây") ppu = isUsd ? gold.pricePerLuongUsd : gold.pricePerLuongVnd;
    else if (wu === "gram" || wu === "g") ppu = isUsd ? gold.pricePerGramUsd : gold.pricePerGramVnd;
    else if (wu === "phân") ppu = Math.round((isUsd ? gold.pricePerChiUsd : gold.pricePerChiVnd) / 10);
    else ppu = isUsd ? gold.pricePerChiUsd : gold.pricePerChiVnd;
    const factor = goldPurityFactor(assetOrConfig.goldPurity);
    return Math.round(ppu * factor);
  }

  if (assetOrConfig.type === "crypto" && assetOrConfig.symbol) {
    const coin = marketPrices.crypto[assetOrConfig.symbol.toUpperCase()];
    if (!coin) return 0;
    return Math.round(isUsd ? coin.usd : coin.vnd);
  }

  return 0;
}

/**
 * Giá trị hiệu dụng của tài sản theo thứ tự ưu tiên:
 * 1) estimatedUnitPrice / estimatedValue nhập tay
 * 2) giá thị trường live (vàng/crypto)
 * 3) giá mua ban đầu
 * 4) không xác định.
 */
export function getEffectiveValue(asset: FamilyAsset, marketPrices: MarketPrices | null): EffectiveValue {
  const quantity = isGoldType(asset.type) ? effectiveGoldWeight(asset) : Number(asset.quantity || 0);

  if (asset.estimatedUnitPrice && asset.estimatedUnitPrice > 0 && quantity > 0) {
    return { value: Math.round(quantity * asset.estimatedUnitPrice), source: "manual" };
  }

  if (Number(asset.estimatedValue) > 0) return { value: Number(asset.estimatedValue), source: "manual" };

  if (marketPrices) {
    const goldWeight = effectiveGoldWeight(asset);
    if (isGoldType(asset.type) && goldWeight > 0) {
      const unitPrice = getMarketUnitPrice(asset, marketPrices);
      const v = Math.round(goldWeight * unitPrice);
      if (v > 0) return { value: v, source: "live" };
    }

    if (asset.type === "crypto" && asset.symbol && asset.quantity > 0) {
      const unitPrice = getMarketUnitPrice(asset, marketPrices);
      const v = Math.round(asset.quantity * unitPrice);
      if (v > 0) return { value: v, source: "live" };
    }
  }

  if (asset.purchaseValue && asset.purchaseValue > 0) {
    return { value: asset.purchaseValue, source: "purchase" };
  }

  return { value: 0, source: "none" };
}

/**
 * Tính khoảng thời gian nắm giữ tài sản từ ngày mua đến hiện tại (hoặc mốc tham chiếu).
 * Trả về chuỗi thân thiện: "Hôm nay", "15 ngày", "3 tháng 10 ngày", "1 năm 17 ngày", v.v.
 */
export function getHoldingDuration(dateStr?: string | null, referenceDate?: Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = referenceDate ? new Date(referenceDate) : new Date();

  const startYear = d.getFullYear();
  const startMonth = d.getMonth();
  const startDay = d.getDate();

  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  const endDay = now.getDate();

  if (new Date(startYear, startMonth, startDay) > new Date(endYear, endMonth, endDay)) {
    return "";
  }

  let years = endYear - startYear;
  let months = endMonth - startMonth;
  let days = endDay - startDay;

  if (days < 0) {
    months -= 1;
    // Lấy số ngày của tháng trước đó
    const prevMonthDays = new Date(endYear, endMonth, 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years === 0 && months === 0 && days === 0) {
    return "Hôm nay";
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} năm`);
  if (months > 0) parts.push(`${months} tháng`);
  if (days > 0 && (years === 0 || months === 0)) {
    parts.push(`${days} ngày`);
  }

  return parts.join(" ");
}
