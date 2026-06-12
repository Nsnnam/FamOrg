/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle, Eraser } from "lucide-react";
import { ShoppingItem, User } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { useConfirm } from "./ConfirmDialog.js";

interface ShoppingProps {
  currentUser: User;
  users: User[];
  shoppingItems: ShoppingItem[];
  onSaveItem: (data: Partial<ShoppingItem>) => Promise<any>;
  onToggleItem: (id: string) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
  onClearPurchased: () => Promise<any>;
}

export function Shopping({
  currentUser,
  users,
  shoppingItems,
  onSaveItem,
  onToggleItem,
  onDeleteItem,
  onClearPurchased
}: ShoppingProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

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
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-400" /> Danh sách đi chợ chung
        </h3>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2.5">
          <input
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

      {ConfirmDialog}
    </div>
  );
}
