/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle, Eraser, ChefHat, Sparkles, X, Loader2 } from "lucide-react";
import { ShoppingItem, User, UserRole } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { useConfirm } from "./ConfirmDialog.js";
import { useTabFab } from "./FabHost.js";
import { useModalA11y } from "../hooks/useModalA11y.js";
import { generateMealPlan, FOOD_CATEGORY_ORDER, MealPlanResult, GroceryLine, FoodCategory } from "../utils/mealPlan.js";

interface ShoppingProps {
  currentUser: User;
  users: User[];
  shoppingItems: ShoppingItem[];
  onSaveItem: (data: Partial<ShoppingItem>) => Promise<any>;
  onToggleItem: (id: string) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
  onClearPurchased: () => Promise<any>;
  authHeaders: Record<string, string>;
}

export function Shopping({
  currentUser,
  users,
  shoppingItems,
  onSaveItem,
  onToggleItem,
  onDeleteItem,
  onClearPurchased,
  authHeaders
}: ShoppingProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  // Ô nhập tên món — nút nổi sẽ cuộn lên đây và focus để thêm nhanh
  const nameInputRef = useRef<HTMLInputElement>(null);
  const focusAddItem = () => {
    nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInputRef.current?.focus();
  };

  // Nút nổi thêm nhanh — cuộn tới ô thêm món và focus
  useTabFab({ id: "shopping", color: "emerald", title: "Thêm món cần mua", icon: ShoppingCart, onClick: focusAddItem });

  // ===== Gợi ý thực đơn cân bằng (meal planner) =====
  const isChildUser = (u: User) => {
    if (u.role === UserRole.CHILD || u.familyRelation === "con") return true;
    if (u.dateOfBirth) {
      const age = (Date.now() - new Date(u.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age > 0 && age < 16) return true;
    }
    return false;
  };
  // Tự suy khẩu phần từ thành viên (bỏ qua khách); người dùng vẫn chỉnh được.
  const householdDefaults = useMemo(() => {
    const members = users.filter(u => u.role !== UserRole.GUEST && u.familyRelation !== "khach");
    const children = members.filter(isChildUser).length;
    const adults = members.length - children;
    return { adults: Math.max(1, adults), children };
  }, [users]);

  const [planOpen, setPlanOpen] = useState(false);
  const [planAdults, setPlanAdults] = useState(householdDefaults.adults);
  const [planChildren, setPlanChildren] = useState(householdDefaults.children);
  const [planDays, setPlanDays] = useState(3);
  const [planNotes, setPlanNotes] = useState("");
  const [plan, setPlan] = useState<MealPlanResult | null>(null);
  const [planBusy, setPlanBusy] = useState<"" | "ai" | "add">("");
  const [planError, setPlanError] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set()); // nguyên liệu bỏ chọn
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const planRef = useRef<HTMLDivElement | null>(null);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  useModalA11y(planOpen, closePlan, planRef);

  useEffect(() => {
    fetch("/api/version", { headers: authHeaders })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setAiEnabled(!!d.aiEnabled); })
      .catch(() => {});
  }, []);

  const openPlanner = () => {
    setPlanAdults(householdDefaults.adults);
    setPlanChildren(householdDefaults.children);
    setPlanError("");
    setAddedCount(null);
    setPlanOpen(true);
  };

  const buildOffline = () => {
    setPlanError("");
    setAddedCount(null);
    setPlan(generateMealPlan({ adults: planAdults, children: planChildren, days: planDays }));
    setExcluded(new Set());
  };

  const buildAI = async () => {
    setPlanBusy("ai");
    setPlanError("");
    setAddedCount(null);
    try {
      const res = await fetch("/api/shopping/meal-plan", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ adults: planAdults, children: planChildren, days: planDays, notes: planNotes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được thực đơn AI.");
      setPlan({ days: data.days, groceries: data.groceries, source: "ai" });
      setExcluded(new Set());
    } catch (err: any) {
      setPlanError(err.message || "Không tạo được thực đơn AI.");
    } finally {
      setPlanBusy("");
    }
  };

  const toggleGrocery = (groceryName: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(groceryName)) next.delete(groceryName); else next.add(groceryName);
      return next;
    });
  };

  const addSelectedToList = async () => {
    if (!plan) return;
    const existing = new Set(shoppingItems.filter(i => !i.isPurchased).map(i => i.name.trim().toLowerCase()));
    const toAdd = plan.groceries.filter(g => !excluded.has(g.name) && !existing.has(g.name.trim().toLowerCase()));
    if (toAdd.length === 0) { setAddedCount(0); return; }
    setPlanBusy("add");
    setPlanError("");
    try {
      for (const g of toAdd) {
        await onSaveItem({ name: g.name, quantity: g.quantity });
      }
      setAddedCount(toAdd.length);
    } catch (err: any) {
      setPlanError(err.message || "Không thêm được vào danh sách.");
    } finally {
      setPlanBusy("");
    }
  };

  const groceryByCat = useMemo(() => {
    const map = new Map<FoodCategory, GroceryLine[]>();
    plan?.groceries.forEach(g => {
      const arr = map.get(g.cat) || [];
      arr.push(g);
      map.set(g.cat, arr);
    });
    return FOOD_CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({ cat: c, items: map.get(c)! }));
  }, [plan]);

  const selectedCount = plan ? plan.groceries.filter(g => !excluded.has(g.name)).length : 0;

  const pending = useMemo(
    () => shoppingItems.filter(i => !i.isPurchased).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [shoppingItems]
  );
  const purchased = useMemo(
    () => shoppingItems.filter(i => i.isPurchased).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [shoppingItems]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Nhập tên món cần mua!");
      return;
    }
    setAdding(true);
    try {
      await onSaveItem({ name: name.trim(), quantity: quantity.trim() });
      setName("");
      setQuantity("");
    } catch (err: any) {
      setError(err.message || "Không thêm được món này");
    } finally {
      setAdding(false);
    }
  };

  const handleClearPurchased = async () => {
    const ok = await confirm({
      title: "Xóa các món đã mua?",
      message: `${purchased.length} món đã đánh dấu hoàn thành sẽ bị xóa khỏi danh sách đi chợ.`,
      confirmLabel: "Xóa hết đã mua",
      tone: "danger"
    });
    if (ok) await onClearPurchased();
  };

  const renderItem = (item: ShoppingItem, done: boolean) => {
    const creator = users.find(u => u.id === item.creatorId);
    return (
      <motion.div
        key={item.id}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl hover:bg-slate-800/30 transition-all group"
      >
        <button
          onClick={() => onToggleItem(item.id)}
          className={`shrink-0 transition-all cursor-pointer ${done ? "text-emerald-400" : "text-slate-500 hover:text-emerald-400"}`}
          title={done ? "Bỏ đánh dấu" : "Đánh dấu đã mua"}
        >
          {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${done ? "line-through text-slate-500" : "text-slate-200"}`}>
            {item.name}
            {item.quantity ? <span className="text-slate-500 font-normal"> · {item.quantity}</span> : null}
          </p>
          <p className="text-[10px] text-slate-500">
            {creator ? creator.fullName.split(" ").slice(-1)[0] : "Thành viên"} thêm
          </p>
        </div>

        {(currentUser.role === "admin" || item.creatorId === currentUser.id) && (
          <button
            onClick={() => onDeleteItem(item.id)}
            className="shrink-0 p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Xóa món này"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6" id="shopping-module">
      {/* Add item bar */}
      <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl space-y-3" id="shopping-add">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" /> Danh sách đi chợ chung
          </h3>
          <button
            type="button"
            onClick={openPlanner}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            title="Gợi ý thực đơn cân bằng cho gia đình"
          >
            <ChefHat className="w-4 h-4" /> Gợi ý thực đơn
          </button>
        </div>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2.5">
          <input
            ref={nameInputRef}
            type="text"
            placeholder="Tên món cần mua (vd: Sữa tươi, Rau cải...)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 text-xs focus:outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Số lượng (tùy chọn)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="sm:w-40 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 text-xs focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm
          </button>
        </form>
        {error && <p className="text-rose-400 text-[11px] font-medium">{error}</p>}
      </div>

      {/* Pending items */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-3" id="shopping-pending">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cần mua ({pending.length})</h4>
        </div>
        {pending.length === 0 ? (
          <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl py-8 text-center">
            <p className="text-sm text-slate-500">Danh sách đi chợ đang trống. Thêm món cần mua ở trên nhé!</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>{pending.map(item => renderItem(item, false))}</AnimatePresence>
          </div>
        )}
      </div>

      {/* Purchased items */}
      {purchased.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-3" id="shopping-purchased">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đã mua ({purchased.length})</h4>
            <button
              onClick={handleClearPurchased}
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5" /> Dọn các món đã mua
            </button>
          </div>
          <div className="space-y-2">
            <AnimatePresence>{purchased.map(item => renderItem(item, true))}</AnimatePresence>
          </div>
        </div>
      )}

      {/* Meal planner modal */}
      {planOpen && (
        <div
          onClick={() => setPlanOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <motion.div
            ref={planRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Gợi ý thực đơn cân bằng"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-emerald-400" /> Gợi ý thực đơn & đi chợ
              </h3>
              <button onClick={() => setPlanOpen(false)} aria-label="Đóng" className="size-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 flex-1 min-h-0 space-y-4 text-xs">
              {/* Khẩu phần & lưu ý */}
              <div className="grid grid-cols-3 gap-2.5">
                <label className="space-y-1">
                  <span className="text-slate-400 font-semibold block">Người lớn</span>
                  <input type="number" min={0} max={10} value={planAdults}
                    onChange={(e) => setPlanAdults(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-emerald-500 font-bold" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 font-semibold block">Trẻ em</span>
                  <input type="number" min={0} max={10} value={planChildren}
                    onChange={(e) => setPlanChildren(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-emerald-500 font-bold" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 font-semibold block">Số ngày</span>
                  <input type="number" min={1} max={7} value={planDays}
                    onChange={(e) => setPlanDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-emerald-500 font-bold" />
                </label>
              </div>
              <label className="space-y-1 block">
                <span className="text-slate-400 font-semibold block">Lưu ý (dị ứng, kiêng khem, ngân sách, sở thích…)</span>
                <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} rows={2}
                  placeholder="VD: bé út dị ứng hải sản, hạn chế đồ chiên, ưu tiên món rẻ…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-emerald-500 resize-none" />
                {!aiEnabled && <span className="text-[10px] text-slate-500">Lưu ý chỉ áp dụng khi tạo bằng AI.</span>}
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={buildOffline} disabled={planBusy !== ""}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                  <ChefHat className="w-4 h-4" /> Tạo thực đơn mẫu
                </button>
                {aiEnabled && (
                  <button type="button" onClick={buildAI} disabled={planBusy !== ""}
                    className="flex-1 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-slate-950 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                    {planBusy === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {planBusy === "ai" ? "Đang nghĩ thực đơn…" : "Tạo bằng AI"}
                  </button>
                )}
              </div>

              {planError && (
                <p className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">{planError}</p>
              )}

              {plan && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.source === "ai" ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"}`}>
                      {plan.source === "ai" ? "✨ AI" : "Mẫu cân bằng"}
                    </span>
                    <span className="text-slate-500">{plan.days.length} ngày · {planAdults} người lớn, {planChildren} trẻ em</span>
                  </div>

                  {/* Thực đơn theo ngày */}
                  <div className="space-y-2">
                    {plan.days.map(d => (
                      <div key={d.day} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                        <p className="text-[11px] font-bold text-slate-300">Ngày {d.day}</p>
                        {d.meals.map((m, i) => (
                          <div key={i} className="flex gap-2 text-[11px]">
                            <span className="text-emerald-400 font-semibold w-10 shrink-0">{m.meal}</span>
                            <span className="text-slate-400">{m.dishes.join(" · ")}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Danh sách nguyên liệu gộp, theo nhóm chất */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Nguyên liệu cần mua ({selectedCount}/{plan.groceries.length})</p>
                    {groceryByCat.map(group => (
                      <div key={group.cat} className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{group.cat}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {group.items.map(g => {
                            const checked = !excluded.has(g.name);
                            return (
                              <button
                                key={g.name}
                                type="button"
                                onClick={() => toggleGrocery(g.name)}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${checked ? "bg-slate-950 border-slate-700" : "bg-slate-950/40 border-slate-850 opacity-50"}`}
                              >
                                {checked ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-slate-600 shrink-0" />}
                                <span className="text-slate-200 truncate flex-1">{g.name}</span>
                                <span className="text-slate-500 font-mono text-[10px] shrink-0">{g.quantity}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {plan && (
              <div className="px-5 py-4 border-t border-slate-800 shrink-0 flex flex-col sm:flex-row items-center gap-2">
                {addedCount !== null && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 mr-auto">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {addedCount > 0 ? `Đã thêm ${addedCount} món vào đi chợ` : "Các món đã có sẵn trong danh sách"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={addSelectedToList}
                  disabled={planBusy !== "" || selectedCount === 0}
                  className="w-full sm:w-auto sm:ml-auto bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  {planBusy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Thêm {selectedCount} món vào đi chợ
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
