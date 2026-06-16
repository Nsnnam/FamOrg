/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Vietnamese balanced meal planner. The dish pool lives in the DB (seeded from
// SEED_DISHES, enriched by AI suggestions over time); generation picks RANDOMLY
// from that pool so each request gives a fresh weekly menu. Pure TS (no JSX) so
// the server can import it too.

import type { FoodCategory, DishSlot, MealIngredient, StoredDish } from "../types.js";

export type { FoodCategory, DishSlot, MealIngredient, StoredDish } from "../types.js";

export const FOOD_CATEGORY_ORDER: FoodCategory[] = ["Đạm", "Rau củ", "Tinh bột", "Trái cây", "Gia vị"];

export interface SeedDish {
  name: string;
  slot: DishSlot;
  ingredients: MealIngredient[];
}

export interface PlannedMeal {
  meal: "Sáng" | "Trưa" | "Tối";
  dishes: string[];
}

export interface PlannedDay {
  day: number;
  meals: PlannedMeal[];
}

export interface GroceryLine {
  name: string;
  cat: FoodCategory;
  quantity: string;
}

export interface MealPlanResult {
  days: PlannedDay[];
  groceries: GroceryLine[];
  source: "random" | "ai" | "offline";
}

const RICE: MealIngredient = { name: "Gạo tẻ", cat: "Tinh bột", adult: 100, child: 60, unit: "g" };

// Tinh bột nền cho bữa cơm — xoay vòng để không phải lúc nào cũng "Cơm trắng".
const STAPLES: { name: string; ing: MealIngredient }[] = [
  { name: "Cơm trắng", ing: RICE },
  { name: "Cơm gạo lứt", ing: { name: "Gạo lứt", cat: "Tinh bột", adult: 100, child: 60, unit: "g" } },
];

// Built-in starter dishes — seeded into the DB on first use.
export const SEED_DISHES: SeedDish[] = [
  // ── Breakfasts (món sáng) ─────────────────────────────────────────────
  { name: "Phở bò", slot: "breakfast", ingredients: [
    { name: "Bánh phở", cat: "Tinh bột", adult: 100, child: 60, unit: "g" },
    { name: "Thịt bò", cat: "Đạm", adult: 60, child: 35, unit: "g" },
    { name: "Hành lá & rau thơm", cat: "Rau củ", adult: 30, child: 20, unit: "g" },
  ]},
  { name: "Bánh mì trứng ốp la", slot: "breakfast", ingredients: [
    { name: "Bánh mì", cat: "Tinh bột", adult: 1, child: 1, unit: "ổ" },
    { name: "Trứng gà", cat: "Đạm", adult: 2, child: 1, unit: "quả" },
    { name: "Dưa leo & cà chua", cat: "Rau củ", adult: 60, child: 40, unit: "g" },
  ]},
  { name: "Xôi đậu xanh", slot: "breakfast", ingredients: [
    { name: "Gạo nếp", cat: "Tinh bột", adult: 80, child: 50, unit: "g" },
    { name: "Đậu xanh", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Cháo thịt bằm", slot: "breakfast", ingredients: [
    { name: "Gạo tẻ", cat: "Tinh bột", adult: 50, child: 30, unit: "g" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 40, child: 25, unit: "g" },
  ]},
  { name: "Bánh cuốn chả", slot: "breakfast", ingredients: [
    { name: "Bánh cuốn", cat: "Tinh bột", adult: 150, child: 90, unit: "g" },
    { name: "Chả lụa", cat: "Đạm", adult: 60, child: 35, unit: "g" },
    { name: "Giá & rau thơm", cat: "Rau củ", adult: 40, child: 25, unit: "g" },
  ]},
  { name: "Cháo gà", slot: "breakfast", ingredients: [
    { name: "Gạo tẻ", cat: "Tinh bột", adult: 50, child: 30, unit: "g" },
    { name: "Thịt gà", cat: "Đạm", adult: 60, child: 35, unit: "g" },
    { name: "Hành lá & gừng", cat: "Rau củ", adult: 20, child: 15, unit: "g" },
  ]},
  { name: "Bún riêu cua", slot: "breakfast", ingredients: [
    { name: "Bún tươi", cat: "Tinh bột", adult: 120, child: 70, unit: "g" },
    { name: "Cua đồng xay", cat: "Đạm", adult: 80, child: 45, unit: "g" },
    { name: "Cà chua & rau muống bào", cat: "Rau củ", adult: 60, child: 40, unit: "g" },
  ]},
  { name: "Bánh canh giò heo", slot: "breakfast", ingredients: [
    { name: "Bánh canh", cat: "Tinh bột", adult: 130, child: 75, unit: "g" },
    { name: "Giò heo", cat: "Đạm", adult: 90, child: 50, unit: "g" },
    { name: "Hành lá & hành phi", cat: "Rau củ", adult: 20, child: 15, unit: "g" },
  ]},
  { name: "Khoai lang & trứng luộc", slot: "breakfast", ingredients: [
    { name: "Khoai lang", cat: "Tinh bột", adult: 150, child: 90, unit: "g" },
    { name: "Trứng gà", cat: "Đạm", adult: 1, child: 1, unit: "quả" },
  ]},
  { name: "Yến mạch sữa chuối", slot: "breakfast", ingredients: [
    { name: "Yến mạch", cat: "Tinh bột", adult: 50, child: 30, unit: "g" },
    { name: "Sữa tươi", cat: "Đạm", adult: 200, child: 150, unit: "ml" },
    { name: "Chuối", cat: "Trái cây", adult: 1, child: 0.5, unit: "quả" },
  ]},

  // ── Mains (món mặn — kho/chiên/xào) ───────────────────────────────────
  { name: "Thịt kho trứng", slot: "main", ingredients: [
    { name: "Thịt heo ba chỉ", cat: "Đạm", adult: 120, child: 70, unit: "g" },
    { name: "Trứng gà", cat: "Đạm", adult: 1, child: 0.5, unit: "quả" },
  ]},
  { name: "Cá kho tộ", slot: "main", ingredients: [
    { name: "Cá (lóc/basa)", cat: "Đạm", adult: 130, child: 75, unit: "g" },
  ]},
  { name: "Gà kho gừng", slot: "main", ingredients: [
    { name: "Thịt gà", cat: "Đạm", adult: 130, child: 75, unit: "g" },
  ]},
  { name: "Bò xào hành tây", slot: "main", ingredients: [
    { name: "Thịt bò", cat: "Đạm", adult: 110, child: 65, unit: "g" },
    { name: "Hành tây", cat: "Rau củ", adult: 0.3, child: 0.2, unit: "củ" },
  ]},
  { name: "Tôm rim thịt ba chỉ", slot: "main", ingredients: [
    { name: "Tôm", cat: "Đạm", adult: 100, child: 60, unit: "g" },
    { name: "Thịt heo ba chỉ", cat: "Đạm", adult: 40, child: 25, unit: "g" },
  ]},
  { name: "Đậu phụ sốt cà chua", slot: "main", ingredients: [
    { name: "Đậu phụ", cat: "Đạm", adult: 1.2, child: 0.7, unit: "miếng" },
    { name: "Cà chua", cat: "Rau củ", adult: 1, child: 0.6, unit: "quả" },
  ]},
  { name: "Trứng chiên thịt bằm", slot: "main", ingredients: [
    { name: "Trứng gà", cat: "Đạm", adult: 1.5, child: 1, unit: "quả" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 40, child: 25, unit: "g" },
  ]},
  { name: "Sườn ram mặn", slot: "main", ingredients: [
    { name: "Sườn heo", cat: "Đạm", adult: 140, child: 80, unit: "g" },
  ]},
  { name: "Sườn xào chua ngọt", slot: "main", ingredients: [
    { name: "Sườn heo", cat: "Đạm", adult: 140, child: 80, unit: "g" },
    { name: "Dứa & ớt chuông", cat: "Rau củ", adult: 60, child: 40, unit: "g" },
  ]},
  { name: "Gà chiên nước mắm", slot: "main", ingredients: [
    { name: "Cánh/đùi gà", cat: "Đạm", adult: 150, child: 85, unit: "g" },
  ]},
  { name: "Cá basa chiên sốt cà", slot: "main", ingredients: [
    { name: "Cá basa", cat: "Đạm", adult: 130, child: 75, unit: "g" },
    { name: "Cà chua", cat: "Rau củ", adult: 1, child: 0.6, unit: "quả" },
  ]},
  { name: "Mực xào dứa", slot: "main", ingredients: [
    { name: "Mực", cat: "Đạm", adult: 120, child: 70, unit: "g" },
    { name: "Dứa & cần tây", cat: "Rau củ", adult: 70, child: 45, unit: "g" },
  ]},
  { name: "Thịt luộc mắm tôm", slot: "main", ingredients: [
    { name: "Thịt heo ba chỉ", cat: "Đạm", adult: 120, child: 70, unit: "g" },
  ]},
  { name: "Bò kho cà rốt", slot: "main", ingredients: [
    { name: "Bắp bò", cat: "Đạm", adult: 130, child: 75, unit: "g" },
    { name: "Cà rốt & khoai tây", cat: "Rau củ", adult: 90, child: 55, unit: "g" },
  ]},
  { name: "Chả lá lốt", slot: "main", ingredients: [
    { name: "Thịt heo bằm", cat: "Đạm", adult: 110, child: 65, unit: "g" },
    { name: "Lá lốt", cat: "Rau củ", adult: 30, child: 20, unit: "g" },
  ]},
  { name: "Tép rang khế", slot: "main", ingredients: [
    { name: "Tép tươi", cat: "Đạm", adult: 100, child: 60, unit: "g" },
    { name: "Khế chua", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "quả" },
  ]},

  // ── Sides (rau/canh) ──────────────────────────────────────────────────
  { name: "Canh rau ngót thịt bằm", slot: "side", ingredients: [
    { name: "Rau ngót", cat: "Rau củ", adult: 0.4, child: 0.25, unit: "bó" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Rau muống xào tỏi", slot: "side", ingredients: [
    { name: "Rau muống", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "bó" },
  ]},
  { name: "Canh bí đỏ nấu tôm", slot: "side", ingredients: [
    { name: "Bí đỏ", cat: "Rau củ", adult: 120, child: 70, unit: "g" },
    { name: "Tôm khô", cat: "Đạm", adult: 10, child: 6, unit: "g" },
  ]},
  { name: "Su su luộc", slot: "side", ingredients: [
    { name: "Su su", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "quả" },
  ]},
  { name: "Canh cải nấu thịt", slot: "side", ingredients: [
    { name: "Cải xanh", cat: "Rau củ", adult: 0.4, child: 0.25, unit: "bó" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Bông cải xào tỏi", slot: "side", ingredients: [
    { name: "Bông cải", cat: "Rau củ", adult: 120, child: 70, unit: "g" },
  ]},
  { name: "Canh chua cá", slot: "side", ingredients: [
    { name: "Cá (lóc/basa)", cat: "Đạm", adult: 60, child: 35, unit: "g" },
    { name: "Bạc hà, giá, cà chua, me", cat: "Rau củ", adult: 100, child: 60, unit: "g" },
  ]},
  { name: "Canh khổ qua nhồi thịt", slot: "side", ingredients: [
    { name: "Khổ qua", cat: "Rau củ", adult: 1, child: 0.6, unit: "quả" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 30, child: 20, unit: "g" },
  ]},
  { name: "Canh mồng tơi mướp", slot: "side", ingredients: [
    { name: "Mồng tơi & mướp", cat: "Rau củ", adult: 0.4, child: 0.25, unit: "bó" },
  ]},
  { name: "Rau lang luộc", slot: "side", ingredients: [
    { name: "Rau lang", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "bó" },
  ]},
  { name: "Cà tím nướng mỡ hành", slot: "side", ingredients: [
    { name: "Cà tím", cat: "Rau củ", adult: 1, child: 0.6, unit: "quả" },
  ]},
  { name: "Đậu bắp luộc chấm kho quẹt", slot: "side", ingredients: [
    { name: "Đậu bắp", cat: "Rau củ", adult: 100, child: 60, unit: "g" },
  ]},
  { name: "Bắp cải luộc", slot: "side", ingredients: [
    { name: "Bắp cải", cat: "Rau củ", adult: 150, child: 90, unit: "g" },
  ]},
  { name: "Cải thìa xào nấm", slot: "side", ingredients: [
    { name: "Cải thìa", cat: "Rau củ", adult: 120, child: 70, unit: "g" },
    { name: "Nấm rơm", cat: "Rau củ", adult: 40, child: 25, unit: "g" },
  ]},

  // ── One-dish meals (món một tô/dĩa đầy đủ — thay cả bữa) ───────────────
  { name: "Bún bò Huế", slot: "onedish", ingredients: [
    { name: "Bún tươi", cat: "Tinh bột", adult: 130, child: 75, unit: "g" },
    { name: "Bắp bò & giò heo", cat: "Đạm", adult: 110, child: 65, unit: "g" },
    { name: "Rau sống, giá, bắp chuối", cat: "Rau củ", adult: 70, child: 45, unit: "g" },
  ]},
  { name: "Cơm tấm sườn bì chả", slot: "onedish", ingredients: [
    { name: "Gạo tấm", cat: "Tinh bột", adult: 110, child: 65, unit: "g" },
    { name: "Sườn heo & chả trứng", cat: "Đạm", adult: 130, child: 75, unit: "g" },
    { name: "Dưa leo, cà chua, đồ chua", cat: "Rau củ", adult: 60, child: 40, unit: "g" },
  ]},
  { name: "Hủ tiếu Nam Vang", slot: "onedish", ingredients: [
    { name: "Hủ tiếu", cat: "Tinh bột", adult: 120, child: 70, unit: "g" },
    { name: "Tôm, thịt, gan", cat: "Đạm", adult: 110, child: 65, unit: "g" },
    { name: "Giá, hẹ, cần tây", cat: "Rau củ", adult: 50, child: 30, unit: "g" },
  ]},
  { name: "Mì Quảng", slot: "onedish", ingredients: [
    { name: "Mì Quảng", cat: "Tinh bột", adult: 120, child: 70, unit: "g" },
    { name: "Tôm & thịt heo", cat: "Đạm", adult: 100, child: 60, unit: "g" },
    { name: "Rau sống & bánh tráng mè", cat: "Rau củ", adult: 60, child: 40, unit: "g" },
  ]},
  { name: "Bún chả Hà Nội", slot: "onedish", ingredients: [
    { name: "Bún tươi", cat: "Tinh bột", adult: 130, child: 75, unit: "g" },
    { name: "Chả thịt nướng", cat: "Đạm", adult: 110, child: 65, unit: "g" },
    { name: "Rau sống & đồ chua", cat: "Rau củ", adult: 70, child: 45, unit: "g" },
  ]},
  { name: "Cơm gà Hội An", slot: "onedish", ingredients: [
    { name: "Cơm gà (gạo tẻ)", cat: "Tinh bột", adult: 110, child: 65, unit: "g" },
    { name: "Thịt gà xé", cat: "Đạm", adult: 120, child: 70, unit: "g" },
    { name: "Rau răm & hành tây", cat: "Rau củ", adult: 40, child: 25, unit: "g" },
  ]},
  { name: "Bánh canh cua", slot: "onedish", ingredients: [
    { name: "Bánh canh", cat: "Tinh bột", adult: 130, child: 75, unit: "g" },
    { name: "Cua & chả", cat: "Đạm", adult: 110, child: 65, unit: "g" },
    { name: "Hành lá & ngò", cat: "Rau củ", adult: 20, child: 15, unit: "g" },
  ]},
  { name: "Phở gà", slot: "onedish", ingredients: [
    { name: "Bánh phở", cat: "Tinh bột", adult: 120, child: 70, unit: "g" },
    { name: "Thịt gà", cat: "Đạm", adult: 100, child: 60, unit: "g" },
    { name: "Hành, rau thơm", cat: "Rau củ", adult: 30, child: 20, unit: "g" },
  ]},
  { name: "Bún thịt nướng", slot: "onedish", ingredients: [
    { name: "Bún tươi", cat: "Tinh bột", adult: 130, child: 75, unit: "g" },
    { name: "Thịt heo nướng", cat: "Đạm", adult: 100, child: 60, unit: "g" },
    { name: "Rau sống, dưa leo, đồ chua", cat: "Rau củ", adult: 70, child: 45, unit: "g" },
  ]},
  { name: "Mì xào bò rau cải", slot: "onedish", ingredients: [
    { name: "Mì trứng", cat: "Tinh bột", adult: 120, child: 70, unit: "g" },
    { name: "Thịt bò", cat: "Đạm", adult: 100, child: 60, unit: "g" },
    { name: "Cải ngọt & cà rốt", cat: "Rau củ", adult: 80, child: 50, unit: "g" },
  ]},

  // ── Fruits (tráng miệng) ──────────────────────────────────────────────
  { name: "Chuối", slot: "fruit", ingredients: [{ name: "Chuối", cat: "Trái cây", adult: 1, child: 1, unit: "quả" }] },
  { name: "Cam", slot: "fruit", ingredients: [{ name: "Cam", cat: "Trái cây", adult: 1, child: 1, unit: "quả" }] },
  { name: "Táo", slot: "fruit", ingredients: [{ name: "Táo", cat: "Trái cây", adult: 1, child: 0.7, unit: "quả" }] },
  { name: "Ổi", slot: "fruit", ingredients: [{ name: "Ổi", cat: "Trái cây", adult: 0.5, child: 0.5, unit: "quả" }] },
  { name: "Dưa hấu", slot: "fruit", ingredients: [{ name: "Dưa hấu", cat: "Trái cây", adult: 200, child: 150, unit: "g" }] },
  { name: "Xoài", slot: "fruit", ingredients: [{ name: "Xoài", cat: "Trái cây", adult: 1, child: 0.6, unit: "quả" }] },
  { name: "Thanh long", slot: "fruit", ingredients: [{ name: "Thanh long", cat: "Trái cây", adult: 0.5, child: 0.4, unit: "quả" }] },
  { name: "Đu đủ", slot: "fruit", ingredients: [{ name: "Đu đủ", cat: "Trái cây", adult: 200, child: 150, unit: "g" }] },
  { name: "Quýt", slot: "fruit", ingredients: [{ name: "Quýt", cat: "Trái cây", adult: 2, child: 1, unit: "quả" }] },
  { name: "Nho", slot: "fruit", ingredients: [{ name: "Nho", cat: "Trái cây", adult: 150, child: 100, unit: "g" }] },
  { name: "Lê", slot: "fruit", ingredients: [{ name: "Lê", cat: "Trái cây", adult: 1, child: 0.7, unit: "quả" }] },
  { name: "Bưởi", slot: "fruit", ingredients: [{ name: "Bưởi", cat: "Trái cây", adult: 3, child: 2, unit: "múi" }] },
];

function formatQuantity(total: number, unit: string): string {
  if (unit === "g") {
    if (total >= 1000) {
      const kg = Math.round((total / 1000) * 10) / 10;
      return `${kg} kg`;
    }
    const rounded = Math.max(50, Math.ceil(total / 50) * 50);
    return `${rounded} g`;
  }
  const n = Math.ceil(total - 1e-9);
  return `${n} ${unit}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type AnyDish = { name: string; slot: DishSlot; ingredients: MealIngredient[] };

/**
 * Build a randomized multi-day plan + consolidated grocery list from a dish pool.
 * Dishes with per-person amounts are summed into precise quantities; AI-learned
 * dishes (ingredient names only) are listed as "vừa đủ".
 */
export function buildPlanFromLibrary(
  pool: AnyDish[],
  opts: { adults: number; children: number; days: number }
): MealPlanResult {
  const a = Math.max(0, Math.floor(opts.adults));
  const c = Math.max(0, Math.floor(opts.children));
  const nDays = Math.min(7, Math.max(1, Math.floor(opts.days)));

  const bySlot = (slot: DishSlot): AnyDish[] => {
    const fromPool = pool.filter(d => d.slot === slot && d.name);
    if (fromPool.length) return shuffle(fromPool);
    return shuffle(SEED_DISHES.filter(d => d.slot === slot));
  };
  const breakfasts = bySlot("breakfast");
  const mains = bySlot("main");
  const sides = bySlot("side");
  const fruits = bySlot("fruit");
  const oneDishes = bySlot("onedish");

  const scaled = new Map<string, { cat: FoodCategory; unit: string; total: number }>();
  const nameOnly = new Map<string, FoodCategory>();
  const add = (ings: MealIngredient[]) => {
    for (const ing of ings) {
      if (!ing?.name) continue;
      if (typeof ing.adult === "number" && ing.unit) {
        const amount = ing.adult * a + (ing.child || 0) * c;
        if (amount <= 0) continue;
        const key = `${ing.name}|${ing.unit}`;
        const cur = scaled.get(key);
        if (cur) cur.total += amount;
        else scaled.set(key, { cat: ing.cat, unit: ing.unit, total: amount });
      } else {
        nameOnly.set(ing.name, ing.cat);
      }
    }
  };

  // Build one lunch/dinner: either a one-dish meal (bún/phở/cơm tấm…) or the
  // classic cơm + món mặn + canh, with the staple rotating so it isn't always
  // plain "Cơm". Indices walk forward so consecutive meals differ.
  let mainIdx = 0, sideIdx = 0, stapleIdx = 0, oneIdx = 0;
  const buildMeal = (asOneDish: boolean): string[] => {
    if (asOneDish && oneDishes.length) {
      const od = oneDishes[oneIdx++ % oneDishes.length];
      add(od.ingredients);
      return [od.name];
    }
    const staple = STAPLES[stapleIdx++ % STAPLES.length];
    const m = mains[mainIdx++ % mains.length];
    const s = sides[sideIdx++ % sides.length];
    add([staple.ing]);
    add(m.ingredients);
    add(s.ingredients);
    return [staple.name, m.name, s.name];
  };

  const days: PlannedDay[] = [];
  for (let d = 0; d < nDays; d++) {
    const b = breakfasts[d % breakfasts.length];
    const fr = fruits[d % fruits.length];
    // Rải món một tô vào ~1/3 số bữa (lệch ngày giữa trưa/tối) để đỡ ngán cơm.
    const lunchOneDish = d % 3 === 1;
    const dinnerOneDish = d % 3 === 2;

    days.push({
      day: d + 1,
      meals: [
        { meal: "Sáng", dishes: [b.name] },
        { meal: "Trưa", dishes: buildMeal(lunchOneDish) },
        { meal: "Tối", dishes: buildMeal(dinnerOneDish) },
      ],
    });

    add(b.ingredients);
    if (fr) add(fr.ingredients);
  }

  const groceries: GroceryLine[] = [];
  for (const [key, v] of scaled) {
    groceries.push({ name: key.split("|")[0], cat: v.cat, quantity: formatQuantity(v.total, v.unit) });
  }
  for (const [name, cat] of nameOnly) {
    groceries.push({ name, cat, quantity: "vừa đủ" });
  }
  groceries.sort((x, y) => {
    const ci = FOOD_CATEGORY_ORDER.indexOf(x.cat) - FOOD_CATEGORY_ORDER.indexOf(y.cat);
    return ci !== 0 ? ci : x.name.localeCompare(y.name, "vi");
  });
  groceries.push({ name: "Gia vị cơ bản (nước mắm, muối, đường, tiêu, hành, tỏi, dầu ăn)", cat: "Gia vị", quantity: "vừa đủ" });

  return { days, groceries, source: "random" };
}

// Client-side fallback when the random endpoint isn't reachable.
export function generateMealPlan(opts: { adults: number; children: number; days: number }): MealPlanResult {
  const res = buildPlanFromLibrary(SEED_DISHES, opts);
  return { ...res, source: "offline" };
}
