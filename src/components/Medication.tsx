/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from "react";
import { Pill, Plus, Trash2, Clock, X } from "lucide-react";
import { MedicationReminder, User, canManageMedication } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { TimeSelect24 } from "./DateTimePicker24.js";
import { useTabFab } from "./FabHost.js";

interface MedicationProps {
  currentUser: User;
  users: User[];
  medications: MedicationReminder[];
  onSaveMedication: (medication: Partial<MedicationReminder>) => Promise<any>;
  onDeleteMedication: (id: string) => Promise<any>;
}

export function Medication({
  currentUser,
  users,
  medications,
  onSaveMedication,
  onDeleteMedication
}: MedicationProps) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [patientId, setPatientId] = useState(currentUser.id);
  const [times, setTimes] = useState<string[]>(["08:00", "20:00"]);
  const [timeDraft, setTimeDraft] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Ô nhập tên thuốc — nút nổi cuộn lên đây và focus để thêm nhanh
  const nameInputRef = useRef<HTMLInputElement>(null);
  const focusAddMed = () => {
    nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInputRef.current?.focus();
  };

  // Nút nổi thêm nhanh — cuộn tới ô thêm lịch thuốc và focus (chỉ người có quyền)
  useTabFab(
    canManageMedication(currentUser.role)
      ? { id: "medications", color: "rose", title: "Thêm lịch nhắc thuốc", icon: Pill, onClick: focusAddMed }
      : null
  );

  const sorted = useMemo(
    () => [...medications].sort((a, b) => a.name.localeCompare(b.name)),
    [medications]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Nhập tên thuốc cần nhắc.");
      return;
    }
    const parsedTimes = times.filter(Boolean);
    if (parsedTimes.length === 0) {
      setError("Thêm ít nhất một giờ uống, ví dụ 08:00.");
      return;
    }

    setSaving(true);
    try {
      await onSaveMedication({
        name: name.trim(),
        dosage: dosage.trim(),
        patientId,
        times: parsedTimes,
        startDate,
        endDate: endDate || undefined,
        notes: notes.trim(),
        isActive: true
      });
      setName("");
      setDosage("");
      setNotes("");
    } catch (err: any) {
      setError(err.message || "Không lưu được lịch thuốc");
    } finally {
      setSaving(false);
    }
  };

  const addTime = () => {
    if (!timeDraft) return;
    if (!times.includes(timeDraft)) {
      setTimes([...times, timeDraft].sort());
    }
    setTimeDraft("");
  };

  const removeTime = (idx: number) => {
    setTimes(times.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6" id="medication-module">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Pill className="w-5 h-5 text-rose-400" /> Nhắc thuốc gia đình
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">{sorted.length} lịch</span>
        </div>

        {canManageMedication(currentUser.role) && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
            <input ref={nameInputRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên thuốc" className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-rose-500" />
            <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Liều dùng" className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-rose-500" />
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-rose-500">
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>

            {/* Giờ uống - chip pickers */}
            <div className="md:col-span-6 bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-2">
              <label className="text-slate-400 font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-rose-400" /> Giờ uống thuốc trong ngày</label>
              <div className="flex flex-wrap items-center gap-2">
                {times.map((t, i) => (
                  <span key={`${t}-${i}`} className="flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg pl-2.5 pr-1 py-1 font-mono text-[11px]">
                    {t}
                    <button type="button" onClick={() => removeTime(i)} className="hover:text-rose-200 cursor-pointer" title="Xóa giờ này">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <TimeSelect24 value={timeDraft} onChange={setTimeDraft} />
                <button type="button" onClick={addTime} className="bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                  <Plus className="w-3 h-3" /> Thêm giờ
                </button>
              </div>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="text-slate-500 text-[10px] block">Ngày bắt đầu</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-rose-500 font-mono" />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-slate-500 text-[10px] block">Ngày kết thúc (tùy chọn)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-rose-500 font-mono" />
            </div>

            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú, sau ăn..." className="md:col-span-4 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:border-rose-500" />
            <button disabled={saving} type="submit" className="md:col-span-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-slate-950 rounded-xl px-3 py-2.5 font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Plus className="w-4 h-4" /> Thêm lịch thuốc
            </button>
          </form>
        )}
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center">
          <p className="text-sm text-slate-500">Chưa có lịch nhắc thuốc nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {sorted.map(med => {
              const patient = users.find(u => u.id === med.patientId);
              return (
                <motion.div
                  key={med.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{med.name}</h4>
                      <p className="text-xs text-slate-500">{med.dosage || "Chưa ghi liều"} • {patient?.fullName || "Thành viên"}</p>
                    </div>
                    {canManageMedication(currentUser.role) && (
                      <button onClick={() => onDeleteMedication(med.id)} className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-950 border border-slate-800 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {med.times.map(time => (
                      <span key={time} className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {time}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{med.notes || "Không có ghi chú thêm."}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
