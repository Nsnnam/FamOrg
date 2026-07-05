/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { Syringe, Plus, Trash2, Check, Calendar, Ruler, HeartPulse, Pill, ShieldAlert, Phone, Pencil, X, Droplet } from "lucide-react";
import { VaccinationRecord, GrowthRecord, MedicationReminder, MedicationLog, User, UserRole, EmergencyProfile, EmergencyContact, BLOOD_TYPE_OPTIONS, FAMILY_RELATION_LABELS } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { assessBmi, ageFromDob, BmiAssessment } from "../utils/bmi.js";
import { Avatar } from "./Avatar.js";
import { Medication } from "./Medication.js";
import { ShimmerLine, Reveal, IconChip, staggerDelay } from "./Lively.js";
import { FancySelect } from "./FancySelect.js";
import { DateInputDMY, formatDateVN } from "./DateTimePicker24.js";

type HealthSection = "growth" | "vaccination" | "medication" | "emergency";

interface ChildHealthProps {
  currentUser: User;
  users: User[];
  vaccinations: VaccinationRecord[];
  growthRecords: GrowthRecord[];
  healthProfiles: EmergencyProfile[];
  medications: MedicationReminder[];
  medicationLogs: MedicationLog[];
  onSaveHealthProfile: (p: Partial<EmergencyProfile>) => Promise<any>;
  onSaveVaccination: (v: Partial<VaccinationRecord>) => Promise<any>;
  onDeleteVaccination: (id: string) => Promise<any>;
  onSaveGrowth: (g: Partial<GrowthRecord>) => Promise<any>;
  onDeleteGrowth: (id: string) => Promise<any>;
  onSaveMedication: (medication: Partial<MedicationReminder>) => Promise<any>;
  onDeleteMedication: (id: string) => Promise<any>;
  onLogDose: (medicationId: string, date: string, time: string, status: "taken" | "skipped" | "none") => Promise<any>;
  // Deep-link: mở sẵn một sub-tab (vd: thông báo thuốc → mục Lịch thuốc)
  requestedSection?: HealthSection;
  requestedSectionSeq?: number;
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

function bmiBadgeClass(c: BmiAssessment["color"]) {
  switch (c) {
    case "emerald": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "amber": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "rose": return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    default: return "bg-slate-700/30 text-slate-300 border-slate-600/40";
  }
}

// Mini SVG line chart cho 1 chỉ số theo thời gian.
function MiniChart({ data, color, unit }: { data: { date: string; value: number }[]; color: string; unit: string }) {
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
}

export function ChildHealth({
  currentUser,
  users,
  vaccinations,
  growthRecords,
  healthProfiles,
  medications,
  medicationLogs,
  onSaveHealthProfile,
  onSaveVaccination,
  onDeleteVaccination,
  onSaveGrowth,
  onDeleteGrowth,
  onSaveMedication,
  onDeleteMedication,
  onLogDose,
  requestedSection,
  requestedSectionSeq
}: ChildHealthProps) {
  // Ưu tiên hiển thị trẻ em trước; nếu không có thì cho chọn bất kỳ thành viên.
  const sortedMembers = useMemo(() => {
    return [...users].sort((a, b) => (a.familyRelation === "con" ? -1 : 0) - (b.familyRelation === "con" ? -1 : 0));
  }, [users]);

  // Sub-tab đang xem
  const [section, setSection] = useState<HealthSection>("growth");
  // Đáp ứng deep-link (vd: bấm thông báo thuốc mở thẳng mục Lịch thuốc)
  useEffect(() => {
    if (requestedSection) setSection(requestedSection);
  }, [requestedSectionSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Thành viên đang chọn ở FORM thêm mới (danh sách hiển thị tất cả thành viên)
  const [formMemberId, setFormMemberId] = useState<string>(sortedMembers[0]?.id || "");
  useEffect(() => {
    if (sortedMembers.length === 0) {
      if (formMemberId) setFormMemberId("");
      return;
    }
    if (!formMemberId || !sortedMembers.some(u => u.id === formMemberId)) {
      setFormMemberId(sortedMembers[0].id);
    }
  }, [sortedMembers, formMemberId]);

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

  // Thẻ khẩn cấp: hồ sơ đang sửa (userId) + các trường form
  const canEditEmergency = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MEMBER;
  const [epEditingId, setEpEditingId] = useState<string | null>(null);
  const [epBlood, setEpBlood] = useState("");
  const [epAllergies, setEpAllergies] = useState("");
  const [epChronic, setEpChronic] = useState("");
  const [epMeds, setEpMeds] = useState("");
  const [epBhyt, setEpBhyt] = useState("");
  const [epNotes, setEpNotes] = useState("");
  const [epContacts, setEpContacts] = useState<EmergencyContact[]>([]);
  const [epError, setEpError] = useState("");
  const [epSaving, setEpSaving] = useState(false);

  const profileByUser = useMemo(() => {
    const map = new Map<string, EmergencyProfile>();
    healthProfiles.forEach(p => map.set(p.userId, p));
    return map;
  }, [healthProfiles]);

  const openEpEdit = (memberId: string) => {
    const p = profileByUser.get(memberId);
    setEpBlood(p?.bloodType || "");
    setEpAllergies(p?.allergies || "");
    setEpChronic(p?.chronicConditions || "");
    setEpMeds(p?.currentMedications || "");
    setEpBhyt(p?.healthInsuranceNumber || "");
    setEpNotes(p?.notes || "");
    setEpContacts(p?.emergencyContacts?.length ? p.emergencyContacts.map(c => ({ ...c })) : [{ name: "", phone: "", relation: "" }]);
    setEpError("");
    setEpEditingId(memberId);
  };

  const saveEp = async () => {
    if (!epEditingId) return;
    setEpSaving(true);
    setEpError("");
    try {
      await onSaveHealthProfile({
        userId: epEditingId,
        bloodType: epBlood || undefined,
        allergies: epAllergies,
        chronicConditions: epChronic,
        currentMedications: epMeds,
        healthInsuranceNumber: epBhyt,
        emergencyContacts: epContacts,
        notes: epNotes
      });
      setEpEditingId(null);
    } catch (err: any) {
      setEpError(err.message || "Không lưu được hồ sơ.");
    } finally {
      setEpSaving(false);
    }
  };

  const vaccinesByChild = useMemo(() => {
    const map = new Map<string, VaccinationRecord[]>();
    for (const v of vaccinations) {
      const list = map.get(v.childId) ?? [];
      list.push(v);
      map.set(v.childId, list);
    }
    map.forEach(list => list.sort((a, b) => (a.scheduledDate || a.doneDate || "").localeCompare(b.scheduledDate || b.doneDate || "")));
    return map;
  }, [vaccinations]);

  const growthByChild = useMemo(() => {
    const map = new Map<string, GrowthRecord[]>();
    for (const g of growthRecords) {
      const list = map.get(g.childId) ?? [];
      list.push(g);
      map.set(g.childId, list);
    }
    map.forEach(list => list.sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }, [growthRecords]);

  // BMI từ bản ghi mới nhất có ĐỦ cả chiều cao & cân nặng của một thành viên.
  const bmiFor = (member: User, records: GrowthRecord[]): BmiAssessment | null => {
    const latest = [...records].reverse().find(g => g.heightCm != null && g.weightKg != null);
    if (!latest) return null;
    return assessBmi(latest.heightCm!, latest.weightKg!, member.dateOfBirth, member.gender);
  };

  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    setVError("");
    if (!formMemberId) { setVError("Chọn thành viên."); return; }
    if (!vName.trim()) { setVError("Nhập tên vắc-xin."); return; }
    try {
      await onSaveVaccination({ childId: formMemberId, name: vName.trim(), doseLabel: vDose.trim() || undefined, scheduledDate: vScheduled || undefined, status: "scheduled", note: vNote.trim() || undefined });
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
    if (!formMemberId) { setGError("Chọn thành viên."); return; }
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
      await onSaveGrowth({ childId: formMemberId, date: gDate, heightCm: height, weightKg: weight });
      setGHeight(""); setGWeight("");
    } catch (err: any) {
      setGError(err.message || "Không lưu được.");
    }
  };

  // Render helpers (hàm thường, không phải component — tránh remount mỗi lần gõ phím)
  // spanClass: cho ô chọn thành viên chiếm trọn hàng của lưới form (khác nhau giữa các form).
  const renderMemberSelect = (accent: string, spanClass: string) => (
    <div className={`space-y-1 ${spanClass}`}>
      <label className="text-slate-500 text-[10px] block">Ghi cho thành viên</label>
      <FancySelect
        value={formMemberId}
        onChange={setFormMemberId}
        ariaLabel="Ghi cho thành viên"
        className={accent}
        options={sortedMembers.map(u => ({ value: u.id, label: u.fullName }))}
      />
    </div>
  );

  // Header nhỏ hiển thị tên + avatar của một thành viên (dùng chung cho các card)
  const renderMemberHeader = (member: User, right?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Avatar user={member} className="w-7 h-7 rounded-lg text-[11px]" extraClass="shrink-0" />
        <span className="text-xs font-bold text-slate-100 truncate">{member.fullName}</span>
      </div>
      {right}
    </div>
  );

  const subTabs: { id: HealthSection; label: string; icon: typeof Ruler; active: string }[] = [
    { id: "growth", label: "Tăng trưởng", icon: Ruler, active: "bg-emerald-500 text-slate-950" },
    { id: "vaccination", label: "Tiêm chủng", icon: Syringe, active: "bg-sky-500 text-slate-950" },
    { id: "medication", label: "Lịch thuốc", icon: Pill, active: "bg-rose-500 text-slate-950" },
    { id: "emergency", label: "Thẻ khẩn cấp", icon: ShieldAlert, active: "bg-amber-500 text-slate-950" }
  ];

  return (
    <div className="space-y-6" id="child-health-module">
      {/* Tiêu đề + thanh sub-tab */}
      <Reveal className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-3 space-y-3">
        <ShimmerLine accent="pink" />
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 px-1">
          <IconChip accent="pink"><HeartPulse className="w-4 h-4" /></IconChip> Sức khỏe gia đình
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
          {subTabs.map(t => {
            const Icon = t.icon;
            const isActive = section === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`px-2 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${isActive ? t.active : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
              >
                <Icon className="w-4 h-4" /> <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* ─── TĂNG TRƯỞNG ─────────────────────────────────────────────── */}
      {section === "growth" && (
        <div className="space-y-5">
          <Reveal delay={0.06} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
            <ShimmerLine accent="emerald" />
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <IconChip accent="emerald"><Ruler className="w-4 h-4" /></IconChip> Ghi số đo (chiều cao / cân nặng)
            </h4>
            <form onSubmit={handleAddGrowth} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {renderMemberSelect("focus:border-emerald-500", "col-span-2 sm:col-span-4")}
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-500 text-[10px] block">Ngày đo</label>
                <DateInputDMY value={gDate} onChange={setGDate} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-emerald-500 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 text-[10px] block">Chiều cao</label>
                <input inputMode="decimal" value={gHeight} onChange={e => setGHeight(e.target.value)} placeholder="Cao (cm)" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 text-[10px] block">Cân nặng</label>
                <input inputMode="decimal" value={gWeight} onChange={e => setGWeight(e.target.value)} placeholder="Nặng (kg)" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-emerald-500" />
              </div>
              <button type="submit" className="col-span-2 sm:col-span-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg px-3 py-2 font-bold flex items-center justify-center gap-1 cursor-pointer self-end"><Plus className="w-4 h-4" /> Ghi</button>
              {gError && <p className="col-span-2 sm:col-span-4 text-[11px] text-rose-400">{gError}</p>}
            </form>
          </Reveal>

          {sortedMembers.length === 0 ? (
            <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có thành viên nào.</p>
          ) : sortedMembers.map((member, memberIndex) => {
            const records = growthByChild.get(member.id) ?? [];
            const bmi = bmiFor(member, records);
            return (
              <Reveal key={member.id} delay={0.12 + staggerDelay(memberIndex, 0.06, 5)} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md p-4 space-y-3">
                {renderMemberHeader(member, bmi ? (
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${bmiBadgeClass(bmi.color)}`}>
                    BMI {bmi.bmi.toFixed(1)} · {bmi.label}
                  </span>
                ) : undefined)}
                {records.length === 0 ? (
                  <p className="text-[11px] text-slate-500 border border-dashed border-slate-800 rounded-lg px-3 py-2 text-center">Chưa có số đo.</p>
                ) : (
                  <>
                    {bmi && (
                      <p className="text-[10px] text-slate-500">
                        {bmi.basis === "adult" && "Đối chiếu chuẩn người lớn châu Á (Việt Nam): <18,5 thiếu cân · 18,5–22,9 bình thường · 23–24,9 thừa cân · 25–29,9 béo phì độ I · ≥30 độ II. "}
                        {bmi.basis === "child" && `Đối chiếu chuẩn WHO theo tuổi & giới${member.gender ? (member.gender === "male" ? " (nam)" : " (nữ)") : ""}${(() => { const a = ageFromDob(member.dateOfBirth); return a != null ? ` · ${Math.floor(a)} tuổi` : ""; })()}. `}
                        {bmi.note}
                      </p>
                    )}
                    {/* Số đo mới nhất — hiện TO rõ, kèm chênh lệch so lần đo trước */}
                    {(() => {
                      const heights = records.filter(g => g.heightCm != null);
                      const weights = records.filter(g => g.weightKg != null);
                      const lastH = heights[heights.length - 1];
                      const prevH = heights[heights.length - 2];
                      const lastW = weights[weights.length - 1];
                      const prevW = weights[weights.length - 2];
                      const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
                      const deltaText = (cur?: number, prev?: number, unit = "") => {
                        if (cur == null || prev == null) return null;
                        const d = Math.round((cur - prev) * 10) / 10;
                        if (d === 0) return <span className="text-slate-500">· không đổi</span>;
                        return (
                          <span className="text-slate-400">
                            · {d > 0 ? "▲ +" : "▼ "}{fmt(d)} {unit}
                          </span>
                        );
                      };
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Chiều cao</p>
                            <p className="mt-1.5 text-3xl md:text-4xl font-extrabold text-emerald-400 tabular-nums leading-none">
                              {lastH ? fmt(lastH.heightCm!) : "—"}
                              <span className="text-sm font-bold text-slate-400 ml-1.5">cm</span>
                            </p>
                            <p className="mt-2 text-[10px] text-slate-500 font-mono">
                              {lastH ? <>đo {formatDateVN(lastH.date)} {deltaText(lastH.heightCm!, prevH?.heightCm ?? undefined, "cm")}</> : "Chưa có số đo"}
                            </p>
                          </div>
                          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Cân nặng</p>
                            <p className="mt-1.5 text-3xl md:text-4xl font-extrabold text-sky-400 tabular-nums leading-none">
                              {lastW ? fmt(lastW.weightKg!) : "—"}
                              <span className="text-sm font-bold text-slate-400 ml-1.5">kg</span>
                            </p>
                            <p className="mt-2 text-[10px] text-slate-500 font-mono">
                              {lastW ? <>đo {formatDateVN(lastW.date)} {deltaText(lastW.weightKg!, prevW?.weightKg ?? undefined, "kg")}</> : "Chưa có số đo"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Chiều cao (cm)</p>
                        <MiniChart data={records.filter(g => g.heightCm != null).map(g => ({ date: g.date, value: g.heightCm! }))} color="#10b981" unit="cm" />
                      </div>
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                        <p className="text-[10px] text-sky-400 font-bold uppercase mb-1">Cân nặng (kg)</p>
                        <MiniChart data={records.filter(g => g.weightKg != null).map(g => ({ date: g.date, value: g.weightKg! }))} color="#0ea5e9" unit="kg" />
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      {[...records].reverse().map(g => (
                        <div key={g.id} className="flex items-center justify-between text-xs bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2">
                          <span className="font-mono text-slate-400">{formatDateVN(g.date)}</span>
                          <span className="text-slate-100 font-bold tabular-nums">
                            {g.heightCm != null ? `${g.heightCm} cm` : "—"} <span className="text-slate-500 font-normal">·</span> {g.weightKg != null ? `${g.weightKg} kg` : "—"}
                          </span>
                          <button onClick={() => onDeleteGrowth(g.id)} className="text-slate-600 hover:text-rose-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Reveal>
            );
          })}
        </div>
      )}

      {/* ─── TIÊM CHỦNG ──────────────────────────────────────────────── */}
      {section === "vaccination" && (
        <div className="space-y-5">
          <Reveal delay={0.06} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
            <ShimmerLine accent="sky" />
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <IconChip accent="sky"><Syringe className="w-4 h-4" /></IconChip> Thêm mũi tiêm
            </h4>
            <form onSubmit={handleAddVaccine} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {renderMemberSelect("focus:border-sky-500", "col-span-1 sm:col-span-2")}
              <input list="vaccine-list" value={vName} onChange={e => setVName(e.target.value)} placeholder="Tên vắc-xin" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500" />
              <datalist id="vaccine-list">{COMMON_VACCINES.map(v => <option key={v} value={v} />)}</datalist>
              <input value={vDose} onChange={e => setVDose(e.target.value)} placeholder="Mũi (vd: Mũi 1, nhắc lại)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500" />
              <div className="space-y-1">
                <label className="text-slate-500 text-[10px] block">Ngày hẹn tiêm</label>
                <DateInputDMY value={vScheduled} onChange={setVScheduled} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500 font-mono" />
              </div>
              <input value={vNote} onChange={e => setVNote(e.target.value)} placeholder="Ghi chú" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-sky-500 self-end" />
              {vError && <p className="sm:col-span-2 text-[11px] text-rose-400">{vError}</p>}
              <button type="submit" className="sm:col-span-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg px-3 py-2 font-bold flex items-center justify-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Thêm mũi tiêm</button>
            </form>
          </Reveal>

          {sortedMembers.length === 0 ? (
            <p className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có thành viên nào.</p>
          ) : sortedMembers.map((member, memberIndex) => {
            const list = vaccinesByChild.get(member.id) ?? [];
            return (
              <Reveal key={member.id} delay={0.12 + staggerDelay(memberIndex, 0.06, 5)} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md p-4 space-y-3">
                {renderMemberHeader(member, <span className="text-[10px] text-slate-500 font-mono shrink-0">{list.length} mũi</span>)}
                {list.length === 0 ? (
                  <p className="text-[11px] text-slate-500 border border-dashed border-slate-800 rounded-lg px-3 py-2 text-center">Chưa có mũi tiêm nào.</p>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {list.map(v => {
                        const dleft = v.status === "scheduled" ? daysLeft(v.scheduledDate) : null;
                        return (
                          <motion.div key={v.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-100 truncate">{v.name} {v.doseLabel && <span className="text-slate-400 font-normal">• {v.doseLabel}</span>}</p>
                              <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2 flex-wrap">
                                {v.status === "done" ? (
                                  <span className="text-emerald-400">✓ Đã tiêm {formatDateVN(v.doneDate) || ""}</span>
                                ) : (
                                  <>
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {v.scheduledDate ? formatDateVN(v.scheduledDate) : "chưa đặt"}</span>
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
              </Reveal>
            );
          })}
        </div>
      )}

      {/* ─── LỊCH THUỐC ──────────────────────────────────────────────── */}
      {section === "medication" && (
        <Medication
          currentUser={currentUser}
          users={users}
          medications={medications}
          medicationLogs={medicationLogs}
          onSaveMedication={onSaveMedication}
          onDeleteMedication={onDeleteMedication}
          onLogDose={onLogDose}
        />
      )}

      {/* ─── THẺ KHẨN CẤP ────────────────────────────────────────────── */}
      {section === "emergency" && (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-500 px-1">
            Thông tin y tế quan trọng của từng thành viên — nhóm máu, dị ứng, bệnh nền, BHYT, liên hệ khẩn cấp.
            Cả nhà đều xem được để dùng khi cấp cứu.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((member, mi) => {
              const p = profileByUser.get(member.id);
              const isEditing = epEditingId === member.id;
              const relationLabel = member.familyRelation ? FAMILY_RELATION_LABELS[member.familyRelation] : "";
              const infoRow = (label: string, value?: string) => value ? (
                <div className="text-[11px] leading-relaxed">
                  <span className="text-slate-500 font-semibold">{label}: </span>
                  <span className="text-slate-300">{value}</span>
                </div>
              ) : null;
              return (
                <Reveal key={member.id} delay={0.05 + staggerDelay(mi)} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-4 space-y-3">
                  <ShimmerLine accent="amber" />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar user={member} className="w-9 h-9 rounded-xl text-sm" extraClass="shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-200 truncate">{member.fullName}</p>
                        {relationLabel && <p className="text-[10px] text-slate-500">{relationLabel}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p?.bloodType && !isEditing && (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-lg px-2 py-1">
                          <Droplet className="w-3.5 h-3.5" /> {p.bloodType}
                        </span>
                      )}
                      {canEditEmergency && !isEditing && (
                        <button type="button" onClick={() => openEpEdit(member.id)} title="Cập nhật hồ sơ" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 cursor-pointer transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isEditing && (
                        <button type="button" onClick={() => setEpEditingId(null)} title="Hủy" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {!isEditing ? (
                    !p ? (
                      <p className="text-[11px] text-slate-600 border border-dashed border-slate-800 rounded-xl px-3 py-4 text-center">
                        Chưa có hồ sơ.{canEditEmergency ? " Bấm ✏️ để cập nhật." : ""}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {infoRow("Dị ứng", p.allergies)}
                        {infoRow("Bệnh nền", p.chronicConditions)}
                        {infoRow("Thuốc đang dùng", p.currentMedications)}
                        {infoRow("Số BHYT", p.healthInsuranceNumber)}
                        {p.emergencyContacts?.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-800/70 space-y-1">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Liên hệ khẩn cấp</p>
                            {p.emergencyContacts.map((c, i) => (
                              <a key={i} href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-[11px] text-slate-300 hover:text-sky-400 transition-colors">
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="font-semibold">{c.name}</span>
                                {c.relation && <span className="text-slate-500">({c.relation})</span>}
                                <span className="font-mono text-sky-400">{c.phone}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {infoRow("Ghi chú", p.notes)}
                      </div>
                    )
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-slate-500 text-[10px] block">Nhóm máu</label>
                          <FancySelect
                            value={epBlood}
                            onChange={setEpBlood}
                            ariaLabel="Nhóm máu"
                            placeholder="Chưa rõ"
                            options={[{ value: "", label: "Chưa rõ" }, ...BLOOD_TYPE_OPTIONS.map(b => ({ value: b, label: b }))]}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500 text-[10px] block">Số BHYT</label>
                          <input value={epBhyt} onChange={e => setEpBhyt(e.target.value)} placeholder="GD-4-79-..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500 font-mono" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-500 text-[10px] block">Dị ứng (thuốc, thức ăn...)</label>
                        <input value={epAllergies} onChange={e => setEpAllergies(e.target.value)} placeholder="Ví dụ: Penicillin, hải sản" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-500 text-[10px] block">Bệnh nền</label>
                        <input value={epChronic} onChange={e => setEpChronic(e.target.value)} placeholder="Ví dụ: Tiểu đường, cao huyết áp" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-500 text-[10px] block">Thuốc đang dùng thường xuyên</label>
                        <input value={epMeds} onChange={e => setEpMeds(e.target.value)} placeholder="Ví dụ: Metformin 500mg sáng/tối" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-500 text-[10px] block">Liên hệ khẩn cấp (tối đa 5)</label>
                        {epContacts.map((c, i) => (
                          <div key={i} className="flex gap-1.5">
                            <input value={c.name} onChange={e => setEpContacts(prev => prev.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} placeholder="Tên" className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 outline-none focus:border-amber-500" />
                            <input value={c.phone} onChange={e => setEpContacts(prev => prev.map((x, xi) => xi === i ? { ...x, phone: e.target.value } : x))} placeholder="SĐT" inputMode="tel" className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 outline-none focus:border-amber-500 font-mono" />
                            <input value={c.relation || ""} onChange={e => setEpContacts(prev => prev.map((x, xi) => xi === i ? { ...x, relation: e.target.value } : x))} placeholder="Quan hệ" className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 outline-none focus:border-amber-500" />
                            <button type="button" onClick={() => setEpContacts(prev => prev.filter((_, xi) => xi !== i))} title="Xóa liên hệ" className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {epContacts.length < 5 && (
                          <button type="button" onClick={() => setEpContacts(prev => [...prev, { name: "", phone: "", relation: "" }])} className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer">
                            <Plus className="w-3 h-3" /> Thêm liên hệ
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-500 text-[10px] block">Ghi chú thêm</label>
                        <textarea value={epNotes} onChange={e => setEpNotes(e.target.value)} rows={2} placeholder="Ví dụ: đang mang thai, có máy trợ tim..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500 resize-none" />
                      </div>

                      {epError && <p className="text-[11px] text-rose-400">{epError}</p>}
                      <button type="button" disabled={epSaving} onClick={saveEp} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-lg px-3 py-2 font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                        <Check className="w-4 h-4" /> {epSaving ? "Đang lưu..." : "Lưu hồ sơ"}
                      </button>
                    </div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
