/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { HandCoins, Plus, Trash2, Calendar, ChevronDown, ChevronUp, X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Debt, User } from "../types.js";
import { motion, AnimatePresence } from "motion/react";

interface DebtTrackerProps {
  currentUser: User;
  users: User[];
  debts: Debt[];
  onSaveDebt: (debt: Partial<Debt>) => Promise<any>;
  onDeleteDebt: (id: string) => Promise<any>;
  onAddDebtPayment: (debtId: string, amount: number, date: string, note?: string) => Promise<any>;
  onRemoveDebtPayment: (debtId: string, paymentId: string) => Promise<any>;
}

const fmtMoney = (n: number) => n.toLocaleString("vi-VN");
const parseMoney = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
const paidOf = (d: Debt) => d.payments.reduce((s, p) => s + p.amount, 0);

function daysLeft(dateStr?: string): number | null {
  if (!dateStr) return null;
  const p = String(dateStr).split("-");
  if (p.length < 3) return null;
  const target = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const t = new Date();
  const todayMid = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((target.getTime() - todayMid.getTime()) / 86400000);
}

export function DebtTracker({
  currentUser,
  users,
  debts,
  onSaveDebt,
  onDeleteDebt,
  onAddDebtPayment,
  onRemoveDebtPayment
}: DebtTrackerProps) {
  const [showForm, setShowForm] = useState(false);
  const [direction, setDirection] = useState<"borrowed" | "lent">("borrowed");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [payDraft, setPayDraft] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const totals = useMemo(() => {
    let owe = 0, lent = 0;
    debts.forEach(d => {
      if (d.isSettled) return;
      const remaining = d.amount - paidOf(d);
      if (remaining <= 0) return;
      if (d.direction === "borrowed") owe += remaining; else lent += remaining;
    });
    return { owe, lent };
  }, [debts]);

  const resetForm = () => { setDirection("borrowed"); setCounterparty(""); setAmount(0); setDueDate(""); setNote(""); setError(""); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!counterparty.trim()) { setError("Nhập tên người / ngân hàng."); return; }
    if (amount <= 0) { setError("Số tiền phải lớn hơn 0."); return; }
    setSaving(true);
    try {
      await onSaveDebt({ direction, counterparty: counterparty.trim(), amount, dueDate: dueDate || undefined, note: note.trim() || undefined });
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "Không lưu được khoản nợ.");
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (debt: Debt) => {
    const amt = parseMoney(payDraft[debt.id] || "");
    if (!amt) return;
    setBusy(debt.id);
    try {
      await onAddDebtPayment(debt.id, amt, new Date().toISOString().slice(0, 10));
      setPayDraft(prev => ({ ...prev, [debt.id]: "" }));
    } catch (err) {
      console.error("Không ghi nhận được khoản trả", err);
    } finally {
      setBusy(null);
    }
  };

  const renderDebt = (debt: Debt) => {
    const paid = paidOf(debt);
    const remaining = Math.max(0, debt.amount - paid);
    const pct = Math.min(100, Math.round((paid / debt.amount) * 100));
    const settled = debt.isSettled || remaining <= 0;
    const dleft = daysLeft(debt.dueDate);
    const isOpen = expanded[debt.id];
    const isBorrowed = debt.direction === "borrowed";
    return (
      <div key={debt.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate">
              {isBorrowed ? <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              {debt.counterparty}
              {settled && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded font-bold">Tất toán ✓</span>}
            </p>
            {debt.note && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{debt.note}</p>}
          </div>
          <button onClick={() => onDeleteDebt(debt.id)} className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer shrink-0" title="Xóa khoản nợ">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
          <div className={`h-full ${settled ? "bg-emerald-500" : isBorrowed ? "bg-rose-500" : "bg-sky-500"} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-mono text-slate-300">Còn {fmtMoney(remaining)} / {fmtMoney(debt.amount)} đ</span>
          {dleft !== null && !settled && (
            <span className={`flex items-center gap-1 font-mono ${dleft < 0 ? "text-rose-400" : dleft <= 7 ? "text-amber-400" : "text-slate-500"}`}>
              <Calendar className="w-3 h-3" /> {dleft < 0 ? `trễ ${-dleft}d` : `còn ${dleft}d`}
            </span>
          )}
        </div>

        {!settled && (
          <div className="flex items-center gap-1.5">
            <input
              inputMode="numeric"
              value={payDraft[debt.id] || ""}
              onChange={e => setPayDraft(prev => ({ ...prev, [debt.id]: e.target.value }))}
              placeholder={isBorrowed ? "Số tiền đã trả" : "Số tiền đã thu"}
              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none focus:border-sky-500 text-[11px]"
            />
            <button disabled={busy === debt.id} onClick={() => handlePay(debt)} className="bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer disabled:opacity-50">
              {isBorrowed ? "Đã trả" : "Đã thu"}
            </button>
          </div>
        )}

        {debt.payments.length > 0 && (
          <div>
            <button onClick={() => setExpanded(prev => ({ ...prev, [debt.id]: !prev[debt.id] }))} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer">
              {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {debt.payments.length} lần {isBorrowed ? "trả" : "thu"}
            </button>
            {isOpen && (
              <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                {debt.payments.map(p => {
                  const by = users.find(u => u.id === p.byId);
                  return (
                    <div key={p.id} className="flex items-center justify-between text-[10px] bg-slate-900/60 rounded-lg px-2 py-1">
                      <span className="font-mono text-slate-400">{p.date}</span>
                      <span className="font-bold text-emerald-400">{fmtMoney(p.amount)}đ</span>
                      <span className="text-slate-500 truncate max-w-[70px]">{by?.fullName || ""}</span>
                      <button onClick={() => onRemoveDebtPayment(debt.id, p.id)} className="text-slate-600 hover:text-rose-400 cursor-pointer" title="Xóa">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const borrowed = debts.filter(d => d.direction === "borrowed");
  const lent = debts.filter(d => d.direction === "lent");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-amber-400" /> Vay / Cho mượn
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {(totals.owe > 0 || totals.lent > 0) && (
            <span className="text-[10px] font-mono text-slate-500">Nợ <span className="text-rose-400 font-bold">{fmtMoney(totals.owe)}</span> · Cho mượn <span className="text-emerald-400 font-bold">{fmtMoney(totals.lent)}</span></span>
          )}
          <button onClick={() => setShowForm(v => !v)} className="bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg px-2.5 py-1.5 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Khoản nợ
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-950/40 border border-slate-800 rounded-xl p-3 overflow-hidden"
          >
            <div className="sm:col-span-2 grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 font-bold text-center">
              <button type="button" onClick={() => setDirection("borrowed")} className={`py-1.5 rounded-md cursor-pointer transition-all ${direction === "borrowed" ? "bg-rose-500 text-slate-950" : "text-slate-400"}`}>Mình nợ (vay)</button>
              <button type="button" onClick={() => setDirection("lent")} className={`py-1.5 rounded-md cursor-pointer transition-all ${direction === "lent" ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}>Cho mượn</button>
            </div>
            <input value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder={direction === "borrowed" ? "Nợ ai / ngân hàng nào" : "Cho ai mượn"} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" />
            <input inputMode="numeric" value={amount > 0 ? fmtMoney(amount) : ""} onChange={e => setAmount(parseMoney(e.target.value))} placeholder="Số tiền" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500 font-mono" />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú (tùy chọn)" className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" />
            {error && <p className="sm:col-span-2 text-[11px] text-rose-400">{error}</p>}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-lg px-3 py-2 font-bold cursor-pointer">Lưu khoản nợ</button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-3 py-2 font-bold cursor-pointer">Hủy</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {debts.length === 0 ? (
        <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có khoản vay/cho mượn nào.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1"><ArrowDownLeft className="w-3.5 h-3.5" /> Mình đang nợ</p>
            {borrowed.length === 0 ? <p className="text-[10px] text-slate-600 px-1">Không có.</p> : borrowed.map(renderDebt)}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> Cho người khác mượn</p>
            {lent.length === 0 ? <p className="text-[10px] text-slate-600 px-1">Không có.</p> : lent.map(renderDebt)}
          </div>
        </div>
      )}
    </div>
  );
}
