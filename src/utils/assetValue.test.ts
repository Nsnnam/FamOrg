/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { AssetType, FamilyAsset } from "../types.js";
import {
  GOLD_PURITY_OPTIONS,
  MarketPrices,
  effectiveGoldWeight,
  getEffectiveValue,
  goldPurityFactor,
  goldPurityLabel,
  isGoldType,
  normalizeGoldPurity
} from "./assetValue.js";

// ---- Fixtures -------------------------------------------------------------

function makeAsset(partial: Partial<FamilyAsset>): FamilyAsset {
  return {
    id: "a1",
    type: "gold_bar" as AssetType,
    name: "Test",
    quantity: 0,
    unit: "chỉ",
    estimatedValue: 0,
    currency: "VND",
    photos: [],
    createdById: "u1",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...partial
  } as FamilyAsset;
}

// Giá vàng tham chiếu: 14.7tr/chỉ (≈ SJC 9999, 06/2026), tỷ giá 25.000.
const market: MarketPrices = {
  gold: {
    pricePerChiVnd: 14_700_000,
    pricePerChiUsd: 588,
    pricePerLuongVnd: 147_000_000,
    pricePerLuongUsd: 5_880,
    pricePerGramVnd: 3_920_000,
    pricePerGramUsd: 156.8,
    source: "SJC"
  },
  crypto: {
    BTC: { usd: 100_000, vnd: 2_500_000_000 },
    ETH: { usd: 4_000, vnd: 100_000_000 }
  },
  usdVndRate: 25_000,
  lastUpdated: "2026-06-14T00:00:00Z"
};

// ---- isGoldType -----------------------------------------------------------

describe("isGoldType", () => {
  it("nhận diện đúng các loại vàng", () => {
    expect(isGoldType("gold_bar")).toBe(true);
    expect(isGoldType("gold_ring")).toBe(true);
    expect(isGoldType("gold_jewelry")).toBe(true);
    expect(isGoldType("gold_other")).toBe(true);
  });
  it("loại khác trả về false", () => {
    expect(isGoldType("crypto")).toBe(false);
    expect(isGoldType("land")).toBe(false);
    expect(isGoldType("other")).toBe(false);
  });
});

// ---- normalizeGoldPurity --------------------------------------------------

describe("normalizeGoldPurity", () => {
  it("giữ nguyên mã đã chuẩn", () => {
    expect(normalizeGoldPurity("9999")).toBe("9999");
    expect(normalizeGoldPurity("585")).toBe("585");
  });
  it("map Karat về phần nghìn", () => {
    expect(normalizeGoldPurity("18k")).toBe("750");
    expect(normalizeGoldPurity("24K")).toBe("9999");
    expect(normalizeGoldPurity("14k")).toBe("585");
  });
  it("map các biến thể", () => {
    expect(normalizeGoldPurity("24")).toBe("9999");
    expect(normalizeGoldPurity("99.99")).toBe("9999");
    expect(normalizeGoldPurity("583")).toBe("585");
    expect(normalizeGoldPurity("417")).toBe("416");
  });
  it("không nhận diện được → rỗng", () => {
    expect(normalizeGoldPurity("xyz")).toBe("");
    expect(normalizeGoldPurity("")).toBe("");
    expect(normalizeGoldPurity(undefined)).toBe("");
  });
});

// ---- goldPurityFactor -----------------------------------------------------

describe("goldPurityFactor", () => {
  it("ưu tiên hệ số trong bảng quy ước (không phải hàm lượng lý thuyết)", () => {
    expect(goldPurityFactor("9999")).toBe(1.0);
    expect(goldPurityFactor("750")).toBe(0.72);  // bảng = 0.72, không phải 0.75
    expect(goldPurityFactor("585")).toBe(0.53);
    expect(goldPurityFactor("416")).toBe(0.38);
  });
  it("map Karat về hệ số trong bảng", () => {
    expect(goldPurityFactor("18k")).toBe(0.72);
    expect(goldPurityFactor("10K")).toBe(0.38);
  });
  it("rỗng/không nhập → 1 (coi như vàng ròng)", () => {
    expect(goldPurityFactor(undefined)).toBe(1);
    expect(goldPurityFactor("")).toBe(1);
  });

  // Fix #2: fallback số lạ không còn định giá sai.
  it("fallback phần trăm: '75' → 0.75, '98' → 0.98 (trước đây bị 0.075/0.098)", () => {
    expect(goldPurityFactor("75")).toBeCloseTo(0.75, 5);
    expect(goldPurityFactor("98")).toBeCloseTo(0.98, 5);
  });
  it("fallback Karat dạng số ≤24: '22' → 22/24", () => {
    expect(goldPurityFactor("22")).toBeCloseTo(22 / 24, 5);
  });
  it("fallback phần nghìn cho số lạ không có trong bảng: '800' → 0.8", () => {
    expect(goldPurityFactor("800")).toBeCloseTo(0.8, 5);
  });
  it("fallback Karat chữ: '20k' → 20/24", () => {
    expect(goldPurityFactor("20k")).toBeCloseTo(20 / 24, 5);
  });
  it("chuỗi vô nghĩa → 1", () => {
    expect(goldPurityFactor("vàng")).toBe(1);
  });
});

// ---- goldPurityLabel ------------------------------------------------------

describe("goldPurityLabel", () => {
  it("hiển thị nhãn đẹp từ mã hoặc Karat", () => {
    expect(goldPurityLabel("750")).toBe("Vàng 750 / 18K");
    expect(goldPurityLabel("18k")).toBe("Vàng 750 / 18K");
  });
  it("rỗng → gạch ngang", () => {
    expect(goldPurityLabel("")).toBe("—");
    expect(goldPurityLabel(undefined)).toBe("—");
  });
  it("không nhận diện → giữ nguyên chuỗi gốc", () => {
    expect(goldPurityLabel("vàng lạ")).toBe("vàng lạ");
  });
});

// ---- effectiveGoldWeight --------------------------------------------------

describe("effectiveGoldWeight", () => {
  it("dùng quantity khi không có weight (dữ liệu mới đã gộp)", () => {
    expect(effectiveGoldWeight({ quantity: 10, weight: undefined })).toBe(10);
  });
  it("ưu tiên field weight cũ nếu có (dữ liệu trước khi gộp)", () => {
    expect(effectiveGoldWeight({ quantity: 1, weight: 5 })).toBe(5);
  });
});

// ---- getEffectiveValue ----------------------------------------------------

describe("getEffectiveValue", () => {
  it("estimatedValue nhập tay luôn thắng", () => {
    const r = getEffectiveValue(makeAsset({ estimatedValue: 5_000_000, quantity: 10 }), market);
    expect(r).toEqual({ value: 5_000_000, source: "manual" });
  });

  it("vàng: quantity × giá 9999 × hệ số (9999 → ×1)", () => {
    const r = getEffectiveValue(
      makeAsset({ type: "gold_bar", quantity: 10, unit: "chỉ", goldPurity: "9999" }),
      market
    );
    expect(r).toEqual({ value: 147_000_000, source: "live" });
  });

  it("vàng tuổi thấp áp hệ số: 10 chỉ 18K → ×0.72", () => {
    const r = getEffectiveValue(
      makeAsset({ type: "gold_jewelry", quantity: 10, unit: "chỉ", goldPurity: "750" }),
      market
    );
    expect(r).toEqual({ value: Math.round(10 * 14_700_000 * 0.72), source: "live" });
  });

  it("vàng dữ liệu cũ: ưu tiên field weight, không nhân đôi với quantity", () => {
    const r = getEffectiveValue(
      makeAsset({ type: "gold_bar", weight: 5, quantity: 1, weightUnit: "chỉ", goldPurity: "9999" }),
      market
    );
    expect(r).toEqual({ value: 73_500_000, source: "live" });
  });

  it("vàng theo lượng dùng đúng giá/lượng", () => {
    const r = getEffectiveValue(
      makeAsset({ type: "gold_bar", quantity: 2, unit: "lượng", goldPurity: "9999" }),
      market
    );
    expect(r).toEqual({ value: 294_000_000, source: "live" });
  });

  it("crypto: quantity × giá coin theo tiền tệ", () => {
    const r = getEffectiveValue(
      makeAsset({ type: "crypto", symbol: "btc", quantity: 2, currency: "USD" }),
      market
    );
    expect(r).toEqual({ value: 200_000, source: "live" });
  });

  it("không có giá live → fallback giá mua ban đầu", () => {
    const r = getEffectiveValue(
      makeAsset({ type: "crypto", symbol: "UNKNOWNCOIN", quantity: 3, purchaseValue: 80_000_000 }),
      market
    );
    expect(r).toEqual({ value: 80_000_000, source: "purchase" });
  });

  it("không có gì → none", () => {
    const r = getEffectiveValue(makeAsset({ type: "other", quantity: 1 }), market);
    expect(r).toEqual({ value: 0, source: "none" });
  });

  it("không có marketPrices nhưng có giá mua → purchase", () => {
    const r = getEffectiveValue(
      makeAsset({ type: "gold_bar", quantity: 10, purchaseValue: 100_000_000 }),
      null
    );
    expect(r).toEqual({ value: 100_000_000, source: "purchase" });
  });
});

// ---- Bảng quy ước nhất quán ----------------------------------------------

describe("GOLD_PURITY_OPTIONS", () => {
  it("hệ số giảm dần theo tuổi vàng và nằm trong (0, 1]", () => {
    for (const o of GOLD_PURITY_OPTIONS) {
      expect(o.factor).toBeGreaterThan(0);
      expect(o.factor).toBeLessThanOrEqual(1);
    }
    const factors = GOLD_PURITY_OPTIONS.map(o => o.factor);
    const sorted = [...factors].sort((a, b) => b - a);
    expect(factors).toEqual(sorted);
  });
});
