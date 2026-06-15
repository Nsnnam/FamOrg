/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Offline Vietnamese balanced meal planner for a household.
// Produces a multi-day menu (sáng / trưa / tối) and a consolidated, category-grouped
// grocery list scaled to the number of adults & children. No network needed — the
// AI path (server) returns the SAME shape so the UI can render either source.

export type FoodCategory = "Đạm" | "Rau củ" | "Tinh bột" | "Trái cây" | "Gia vị";

export const FOOD_CATEGORY_ORDER: FoodCategory[] = ["Đạm", "Rau củ", "Tinh bột", "Trái cây", "Gia vị"];

interface Ingredient {
  name: string;
  cat: FoodCategory;
  adult: number; // amount per adult, per serving of this dish
  child: number; // amount per child
  unit: string;  // "g" = weight; anything else = countable unit (quả, bó, củ, ổ, miếng)
}

interface Dish {
  name: string;
  ings: Ingredient[];
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
  quantity: string; // human-friendly, e.g. "1.2 kg", "6 quả", "vừa đủ"
}

export interface MealPlanResult {
  days: PlannedDay[];
  groceries: GroceryLine[];
  source: "offline" | "ai";
}

export interface MealPlanOptions {
  adults: number;
  children: number;
  days: number;
}

const RICE: Ingredient = { name: "Gạo tẻ", cat: "Tinh bột", adult: 100, child: 60, unit: "g" };

const BREAKFASTS: Dish[] = [
  { name: "Phở bò", ings: [
    { name: "Bánh phở", cat: "Tinh bột", adult: 100, child: 60, unit: "g" },
    { name: "Thịt bò", cat: "Đạm", adult: 60, child: 35, unit: "g" },
    { name: "Hành lá & rau thơm", cat: "Rau củ", adult: 30, child: 20, unit: "g" },
  ]},
  { name: "Bánh mì trứng ốp la", ings: [
    { name: "Bánh mì", cat: "Tinh bột", adult: 1, child: 1, unit: "ổ" },
    { name: "Trứng gà", cat: "Đạm", adult: 2, child: 1, unit: "quả" },
    { name: "Dưa leo & cà chua", cat: "Rau củ", adult: 60, child: 40, unit: "g" },
  ]},
  { name: "Xôi đậu xanh", ings: [
    { name: "Gạo nếp", cat: "Tinh bột", adult: 80, child: 50, unit: "g" },
    { name: "Đậu xanh", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Cháo thịt bằm", ings: [
    { name: "Gạo tẻ", cat: "Tinh bột", adult: 50, child: 30, unit: "g" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 40, child: 25, unit: "g" },
  ]},
  { name: "Bún thịt nướng", ings: [
    { name: "Bún tươi", cat: "Tinh bột", adult: 120, child: 70, unit: "g" },
    { name: "Thịt heo", cat: "Đạm", adult: 70, child: 40, unit: "g" },
    { name: "Rau sống", cat: "Rau củ", adult: 60, child: 35, unit: "g" },
  ]},
];

const MAINS: Dish[] = [
  { name: "Thịt kho trứng", ings: [
    { name: "Thịt heo ba chỉ", cat: "Đạm", adult: 120, child: 70, unit: "g" },
    { name: "Trứng gà", cat: "Đạm", adult: 1, child: 0.5, unit: "quả" },
  ]},
  { name: "Cá kho tộ", ings: [
    { name: "Cá (lóc/basa)", cat: "Đạm", adult: 130, child: 75, unit: "g" },
  ]},
  { name: "Gà kho gừng", ings: [
    { name: "Thịt gà", cat: "Đạm", adult: 130, child: 75, unit: "g" },
  ]},
  { name: "Bò xào hành tây", ings: [
    { name: "Thịt bò", cat: "Đạm", adult: 110, child: 65, unit: "g" },
    { name: "Hành tây", cat: "Rau củ", adult: 0.3, child: 0.2, unit: "củ" },
  ]},
  { name: "Tôm rim", ings: [
    { name: "Tôm", cat: "Đạm", adult: 110, child: 65, unit: "g" },
  ]},
  { name: "Đậu phụ sốt cà chua", ings: [
    { name: "Đậu phụ", cat: "Đạm", adult: 1.2, child: 0.7, unit: "miếng" },
    { name: "Cà chua", cat: "Rau củ", adult: 1, child: 0.6, unit: "quả" },
  ]},
  { name: "Trứng chiên thịt bằm", ings: [
    { name: "Trứng gà", cat: "Đạm", adult: 1.5, child: 1, unit: "quả" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 40, child: 25, unit: "g" },
  ]},
  { name: "Sườn ram mặn", ings: [
    { name: "Sườn heo", cat: "Đạm", adult: 140, child: 80, unit: "g" },
  ]},
];

const SIDES: Dish[] = [
  { name: "Canh rau ngót thịt bằm", ings: [
    { name: "Rau ngót", cat: "Rau củ", adult: 0.4, child: 0.25, unit: "bó" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Rau muống xào tỏi", ings: [
    { name: "Rau muống", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "bó" },
  ]},
  { name: "Canh bí đỏ", ings: [
    { name: "Bí đỏ", cat: "Rau củ", adult: 120, child: 70, unit: "g" },
  ]},
  { name: "Su su luộc", ings: [
    { name: "Su su", cat: "Rau củ", adult: 0.5, child: 0.3, unit: "quả" },
  ]},
  { name: "Canh cải nấu thịt", ings: [
    { name: "Cải xanh", cat: "Rau củ", adult: 0.4, child: 0.25, unit: "bó" },
    { name: "Thịt heo bằm", cat: "Đạm", adult: 25, child: 15, unit: "g" },
  ]},
  { name: "Bông cải xào", ings: [
    { name: "Bông cải", cat: "Rau củ", adult: 120, child: 70, unit: "g" },
  ]},
];

const FRUITS: Ingredient[] = [
  { name: "Chuối", cat: "Trái cây", adult: 1, child: 1, unit: "quả" },
  { name: "Cam", cat: "Trái cây", adult: 1, child: 1, unit: "quả" },
  { name: "Táo", cat: "Trái cây", adult: 1, child: 0.7, unit: "quả" },
  { name: "Ổi", cat: "Trái cây", adult: 0.5, child: 0.5, unit: "quả" },
  { name: "Dưa hấu", cat: "Trái cây", adult: 200, child: 150, unit: "g" },
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

export function generateMealPlan({ adults, children, days }: MealPlanOptions): MealPlanResult {
  const a = Math.max(0, Math.floor(adults));
  const c = Math.max(0, Math.floor(children));
  const nDays = Math.min(14, Math.max(1, Math.floor(days)));

  const acc = new Map<string, { cat: FoodCategory; unit: string; total: number }>();
  const add = (ings: Ingredient[]) => {
    for (const ing of ings) {
      const amount = ing.adult * a + ing.child * c;
      if (amount <= 0) continue;
      const key = `${ing.name}|${ing.unit}`;
      const cur = acc.get(key);
      if (cur) cur.total += amount;
      else acc.set(key, { cat: ing.cat, unit: ing.unit, total: amount });
    }
  };

  const plannedDays: PlannedDay[] = [];
  const half = Math.floor(MAINS.length / 2);

  for (let d = 0; d < nDays; d++) {
    const breakfast = BREAKFASTS[d % BREAKFASTS.length];
    const lunchMain = MAINS[d % MAINS.length];
    const lunchSide = SIDES[d % SIDES.length];
    const dinnerMain = MAINS[(d + half) % MAINS.length];
    const dinnerSide = SIDES[(d + 1) % SIDES.length];
    const fruit = FRUITS[d % FRUITS.length];

    plannedDays.push({
      day: d + 1,
      meals: [
        { meal: "Sáng", dishes: [breakfast.name] },
        { meal: "Trưa", dishes: ["Cơm", lunchMain.name, lunchSide.name] },
        { meal: "Tối", dishes: ["Cơm", dinnerMain.name, dinnerSide.name] },
      ],
    });

    add(breakfast.ings);
    add([RICE]);
    add(lunchMain.ings);
    add(lunchSide.ings);
    add([RICE]);
    add(dinnerMain.ings);
    add(dinnerSide.ings);
    add([fruit]);
  }

  const groceries: GroceryLine[] = [];
  for (const [key, v] of acc) {
    const name = key.split("|")[0];
    groceries.push({ name, cat: v.cat, quantity: formatQuantity(v.total, v.unit) });
  }
  // Stable, readable ordering: by category, then name.
  groceries.sort((x, y) => {
    const ci = FOOD_CATEGORY_ORDER.indexOf(x.cat) - FOOD_CATEGORY_ORDER.indexOf(y.cat);
    return ci !== 0 ? ci : x.name.localeCompare(y.name, "vi");
  });

  // Basic seasonings — bought as needed, not scaled.
  groceries.push({ name: "Gia vị cơ bản (nước mắm, muối, đường, tiêu, hành, tỏi, dầu ăn)", cat: "Gia vị", quantity: "vừa đủ" });

  return { days: plannedDays, groceries, source: "offline" };
}
