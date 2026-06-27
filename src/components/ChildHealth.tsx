/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { Syringe, Plus, Trash2, Check, Calendar, Ruler, HeartPulse } from "lucide-react";
import { VaccinationRecord, GrowthRecord, User } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { assessBmi, ageFromDob, BmiAssessment } from "../utils/bmi.js";

interface ChildHealthProps {
  currentUser: User;
  users: User[];
  vaccinations: VaccinationRecord[];
  growthRecords: GrowthRecord[];
  onSaveVaccination: (v: Partial<VaccinationRecord>) => Promise<any>;
  onDeleteVaccination: (id: string) => Promise<any>;
  onSaveGrowth: (g: Partial<GrowthRecord>) => Promise<any>;
  onDeleteGrowth: (id: string) => Promise<any>;
}

// Vắc-xin phổ biến theo lịch tiêm chủng VN (gợi ý qua datalist, vẫn cho tự nhập).
const COMMON_VACCINES = [
  "Lao (BCG)", "Viêm gan B", "6 trong 1", "5 trong 1", "Bại liệt (OPV/IPV)",
  "Phế cầu", "Rota (uống)", "Sởi", "Sởi - Quai bị - Rubella (MMR)",
  "Viêm não Nhật Bản", "Thủy đậu", "Cúm", "Viêm gan A",
  "Bạch hầu - Ho gà - Uốn ván (DPT)", "HPV"
];

function daysLeft(dateStr?: string): number | null {
  if (!dateStr) return null;
  const p = String(dateStr).split("-");
  if (p.length < 3) return null;
  const target = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const t = new Date();
  return Math.round((target.getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86400000);
}

function parsePositiveMeasurement(value: string): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const num = Number(raw.replace(",", "."));
  return Number.isFinite(num) && num > 0 ? num : NaN;
}

export function ChildHealth({
  currentUser,
  users,
  vaccinations,
  growthRecords,
  onSaveVaccination,
  onDeleteVaccination,
  onSaveGrowth,
  onDeleteGrowth
}: ChildHealthProps) {
  // Ưu tiên hiển thị trẻ em trước; nếu không có thì cho chọn bất kỳ thành viên.
  const sortedMembers = useMemo(() => {
    return [...users].sort((a, b) => (a.familyRelation === "con" ? -1 : 0) - (b.familyRelation === "con" ? -1 : 0));
  }, [users]);
  const [childId, setChildId] = useState<string>(sortedMembers[0]?.id || "");

  useEffect(() => {
    if (sortedMembers.length === 0) {
      if (childId) setChildId("");
      return;
    }
    if (!childId || !sortedMembers.some(u => u.id === childId)) {
      setChildId(sortedMembers[0].id);
    }
  }, [sortedMembers, childId]);

  // Vaccination form
  const [vName, setVName] = useState("");
  const [vDose, setVDose] = useState("");
  const [vScheduled, setVScheduled] = useState("");
  const [vNote, setVNote] = useState("");
  const [vError, setVError] = useState("");

  // Growth form
  const [gDate, setGDate] = useState(new Date().toISOString().slice(0, 10));
  const [gHeight, setGHeight] = useState("");
  const [gWeight, setGWeight] = useState("");
  const [gError, setGError] = useState("");

  const childVaccines = useMemo(
    () => vaccinations.filter(v => v.childId === childId)
      .sort((a, b) => (a.scheduledDate || a.doneDate || "").localeCompare(b.scheduledDate || b.doneDate || "")),
    [vaccinations, childId]
  );
  const childGrowth = useMemo(
    () => growthRecords.filter(g => g.childId === childId).sort((a, b) => a.date.localeCompare(b.date)),
    [growthRecords, childId]
  );

  const selectedMember = useMemo(() => users.find(u => u.id === childId), [users, childId]);

  // BMI từ bản ghi mới nhất có ĐỦ cả chiều cao & cân nặng.
  const bmiInfo = useMemo<BmiAssessment | null>(() => {
    const latest = [...childGrowth].reverse().find(g => g.heightCm != null && g.weightKg != null);
    if (!latest || !selectedMember) return null;
    return assessBmi(latest.heightCm!, latest.weightKg!, selectedMember.dateOfBirth, selectedMember.gender);
  }, [childGrowth, selectedMember]);

  const bmiBadgeClass = (c: BmiAssessment["color"]) => {
    switch (c) {
      case "emerald": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "amber": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "rose": return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      default: return "bg-slate-700/30 text-slate-300 border-slate-600/40";
    }
  };

  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    setVError("");
    if (!childId) { setVError("Chọn thành viên."); return; }
    if (!vName.trim()) { setVError("Nhập tên vắc-xin."); return; }
    try {
      await onSaveVaccination({ childId, name: vName.trim(), doseLabel: vDose.trim() || undefined, scheduledDate: vScheduled || undefined, status: "scheduled", note: vNote.trim() || undefined });
      setVName(""); setVDose(""); setVScheduled(""); setVNote("");
    } catch (err: any) {
      setVError(err.message || "Không lưu được.");
    }
  };

  const toggleVaccineDone = async (v: VaccinationRecord) => {
    const done = v.status === "done";
    await onSaveVaccination({
      id: v.id, childId: v.childId, name: v.name, doseLabel: v.doseLabel, scheduledDate: v.scheduledDate,
      status: done ? "scheduled" : "done",
      doneDate: done ? undefined : new Date().toISOString().slice(0, 10),
      note: v.note
    });
  };

  const handleAddGrowth = async (e: React.FormEvent) => {
    e.preventDefault();
    setGError("");
    if (!childId) { setGError("Chọn thành viên."); return; }
    if (!gHeight && !gWeight) { setGError("Nhập chiều cao hoặc cân nặng."); return; }
    const height = parsePositiveMeasurement(gHeight);
    const weight = parsePositiveMeasurement(gWeight);
    if (height === undefined && weight === undefined) {
      setGError("Nhập chiều cao hoặc cân nặng.");
      return;
    }
    if (Number.isNaN(height) || Number.isNaN(weight)) {
      setGError("Chiều cao/cân nặng phải lớn hơn 0.");
      return;
    }
    try {
      await onSaveGrowth({ childId, date: gDate, heightCm: height, weightKg: weight });
      setGHeight(""); setGWeight("");
    } catch (err: any) {
      setGError(err.message || "Không lưu được.");
    }
  };

  // Mini SVG line chart cho 1 chỉ số theo thời gian.
  const MiniChart = ({ data, color, unit }: { data: { date: string; value: number }[]; color: string; unit: string }) => {
    if (data.length === 0) return <p className="text-[10px] text-slate-600">Chưa có dữ liệu.</p>;
    const values = data.map(d => d.value);
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const W = 240, H = 60, pad = 6;
    const pts = data.map((d, i) => {
      const x = data.length === 1 ? W / 2 : pad + (i / (data.length - 1)) * (W - 2 * pad);
      const y = H - pad - ((d.value - min) / range) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <div className="space-y-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
          <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => {
            const x = data.length === 1 ? W / 2 : pad + (i / (data.length - 1)) * (W - 2 * pad);
            const y = H - pad - ((d.value - min) / range) * (H - 2 * pad);
            return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
          })}
        </svg>
        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
          <span>{min}{unit}</span><span>{max}{unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="child-health-module">
      {/* Chọn thành viên */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-pink-400" /> Sức khỏe gia đình
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-500">Thành viên:</label>
          <select value={childId} onChange={e => setChildId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-pink-500">
            {sortedMembers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
      </div>

      {/* Tiêm chủng */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Syringe className="w-4.5 h-4.5 text-sky-400" /> Lịch tiêm chủng
        </h4>
        <form onSubmit={handleAddVaccine} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <input list="vaccine-list" value={vName} onChange={e => setVName(e.target.value)} placeholder="Tên vắc-xin" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500" />
          <datalist id="vaccine-list">{COMMON_VACCINES.map(v => <option key={v} value={v} />)}</datalist>
          <input value={vDose} onChange={e => setVDose(e.target.value)} placeholder="Mũi (vd: Mũi 1, nhắc lại)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500" />
          <div className="space-y-1">
            <label className="text-slate-500 text-[10px] block">Ngày hẹn tiêm</label>
            <input type="date" value={vScheduled} onChange={e => setVScheduled(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500 font-mono" />
          </div>
          <input value={vNote} onChange={e => setVNote(e.target.value)} placeholder="Ghi chú" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500 self-end" />
          {vError && <p className="sm:col-span-2 text-[11px] text-rose-400">{vError}</p>}
          <button type="submit" className="sm:col-span-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg px-3 py-2 font-bold flex items-center justify-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Thêm mũi tiêm</button>
        </form>

        {childVaccines.length === 0 ? (
          <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có mũi tiêm nào.</p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {childVaccines.map(v => {
                const dleft = v.status === "scheduled" ? daysLeft(v.scheduledDate) : null;
                return (
                  <motion.div key={v.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 truncate">{v.name} {v.doseLabel && <span className="text-slate-400 font-normal">• {v.doseLabel}</span>}</p>
                      <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2 flex-wrap">
                        {v.status === "done" ? (
                          <span className="text-emerald-400">✓ Đã tiêm {v.doneDate || ""}</span>
                        ) : (
                          <>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {v.scheduledDate || "chưa đặt"}</span>
                            {dleft !== null && <span className={dleft < 0 ? "text-rose-400" : dleft <= 7 ? "text-amber-400" : "text-slate-500"}>{dleft < 0 ? `trễ ${-dleft}d` : `còn ${dleft}d`}</span>}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleVaccineDone(v)} className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${v.status === "done" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-900 text-emerald-400 border-slate-700 hover:border-emerald-500/50"}`} title="Đánh dấu đã tiêm">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDeleteVaccination(v.id)} className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Tăng trưởng */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Ruler className="w-4.5 h-4.5 text-emerald-400" /> Tăng trưởng (chiều cao / cân nặng)
        </h4>
        <form onSubmit={handleAddGrowth} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <input type="date" value={gDate} onChange={e => setGDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-emerald-500 font-mono" />
          <input inputMode="decimal" value={gHeight} onChange={e => setGHeight(e.target.value)} placeholder="Cao (cm)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-emerald-500" />
          <input inputMode="decimal" value={gWeight} onChange={e => setGWeight(e.target.value)} placeholder="Nặng (kg)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-emerald-500" />
          <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg px-3 py-2 font-bold flex items-center justify-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Ghi</button>
          {gError && <p className="col-span-2 sm:col-span-4 text-[11px] text-rose-400">{gError}</p>}
        </form>

        {/* Đánh giá BMI (từ số đo mới nhất có đủ cao & nặng) */}
        {bmiInfo && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase">BMI hiện tại</span>
                <span className="text-xl font-extrabold text-slate-100 tabular-nums">{bmiInfo.bmi.toFixed(1)}</span>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${bmiBadgeClass(bmiInfo.color)}`}>
                {bmiInfo.label}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              {bmiInfo.basis === "adult" && "Đối chiếu chuẩn người lớn châu Á (Việt Nam): <18,5 thiếu cân · 18,5–22,9 bình thường · 23–24,9 thừa cân · 25–29,9 béo phì độ I · ≥30 độ II."}
              {bmiInfo.basis === "child" && `Đối chiếu chuẩn WHO theo tuổi & giới${selectedMember?.gender ? (selectedMember.gender === "male" ? " (nam)" : " (nữ)") : ""}${(() => { const a = ageFromDob(selectedMember?.dateOfBirth); return a != null ? ` · ${Math.floor(a)} tuổi` : ""; })()}.`}
              {bmiInfo.note}
            </p>
          </div>
        )}

        {childGrowth.length === 0 ? (
          <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có số đo nào.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Chiều cao (cm)</p>
                <MiniChart data={childGrowth.filter(g => g.heightCm != null).map(g => ({ date: g.date, value: g.heightCm! }))} color="#10b981" unit="cm" />
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] text-sky-400 font-bold uppercase mb-1">Cân nặng (kg)</p>
                <MiniChart data={childGrowth.filter(g => g.weightKg != null).map(g => ({ date: g.date, value: g.weightKg! }))} color="#0ea5e9" unit="kg" />
              </div>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...childGrowth].reverse().map(g => (
                <div key={g.id} className="flex items-center justify-between text-[11px] bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-1.5">
                  <span className="font-mono text-slate-400">{g.date}</span>
                  <span className="text-slate-200">{g.heightCm != null ? `${g.heightCm} cm` : "—"} · {g.weightKg != null ? `${g.weightKg} kg` : "—"}</span>
                  <button onClick={() => onDeleteGrowth(g.id)} className="text-slate-600 hover:text-rose-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
