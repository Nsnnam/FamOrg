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

// Built-in starter dishes — seeded into the DB on first use.
export const SEED_DISHES: SeedDish[] = [
  // Breakfasts
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
  { name: "Bún thịt nướng", slot: "breakfast", ingredients: [
    { name: "Bún tươi", cat: "Tinh bột", adult: 120, child: 70, unit: "g" },
    { name: "Thịt heo", cat: "Đạm", adult: 70, child: 40, unit: "g" },
    { name: "Rau sống", cat: "Rau củ", adult: 60, child: 35, unit: "g" },
  ]},
  // Mains (món mặn)
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
  { name: "Tôm rim", slot: "main", ingredients: [
    { name: "Tôm", cat: "Đạm", adult: 110, child: 65, unit: "g" },
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
  // Sides (rau/canh)
  { name: "Canh rau ngót thịt bằm", slot: "side", ingredients: [
    { name: "Rau ngót", cat: "Rau củ", adult: 0.4, child: 0.25, unit: "bó" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Rau muống xào tỏi", slot: "side", ingredients: [
    { name: "Rau muống", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "bó" },
  ]},
  { name: "Canh bí đỏ", slot: "side", ingredients: [
    { name: "Bí đỏ", cat: "Rau củ", adult: 120, child: 70, unit: "g" },
  ]},
  { name: "Su su luộc", slot: "side", ingredients: [
    { name: "Su su", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "quả" },
  ]},
  { name: "Canh cải nấu thịt", slot: "side", ingredients: [
    { name: "Cải xanh", cat: "Rau củ", adult: 0.4, child: 0.25, unit: "bó" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Bông cải xào", slot: "side", ingredients: [
    { name: "Bông cải", cat: "Rau củ", adult: 120, child: 70, unit: "g" },
  ]},
  // Fruits
  { name: "Chuối", slot: "fruit", ingredients: [{ name: "Chuối", cat: "Trái cây", adult: 1, child: 1, unit: "quả" }] },
  { name: "Cam", slot: "fruit", ingredients: [{ name: "Cam", cat: "Trái cây", adult: 1, child: 1, unit: "quả" }] },
  { name: "Táo", slot: "fruit", ingredients: [{ name: "Táo", cat: "Trái cây", adult: 1, child: 0.7, unit: "quả" }] },
  { name: "Ổi", slot: "fruit", ingredients: [{ name: "Ổi", cat: "Trái cây", adult: 0.5, child: 0.5, unit: "quả" }] },
  { name: "Dưa hấu", slot: "fruit", ingredients: [{ name: "Dưa hấu", cat: "Trái cây", adult: 200, child: 150, unit: "g" }] },
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

  const days: PlannedDay[] = [];
  for (let d = 0; d < nDays; d++) {
    const b = breakfasts[d % breakfasts.length];
    const m1 = mains[d % mains.length];
    const m2 = mains[(d + Math.max(1, Math.floor(mains.length / 2))) % mains.length];
    const s1 = sides[d % sides.length];
    const s2 = sides[(d + 1) % sides.length];
    const fr = fruits[d % fruits.length];

    days.push({
      day: d + 1,
      meals: [
        { meal: "Sáng", dishes: [b.name] },
        { meal: "Trưa", dishes: ["Cơm", m1.name, s1.name] },
        { meal: "Tối", dishes: ["Cơm", m2.name, s2.name] },
      ],
    });

    add(b.ingredients);
    add([RICE]);
    add(m1.ingredients);
    add(s1.ingredients);
    add([RICE]);
    add(m2.ingredients);
    add(s2.ingredients);
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
