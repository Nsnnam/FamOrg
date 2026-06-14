/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from "react";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Clock, 
  Pencil,
  Repeat, 
  Lock, 
  Eye, 
  Tag, 
  LayoutList,
  LayoutGrid,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { FamilyPlan, User, UserRole, isLimitedViewer } from "../types.js";
import { motion, AnimatePresence } from "motion/react";
import { useConfirm } from "./ConfirmDialog.js";
import { DateTimePicker24 } from "./DateTimePicker24.js";
import { useModalA11y } from "../hooks/useModalA11y.js";

interface SchedulesProps {
  currentUser: User;
  users: User[];
  plans: FamilyPlan[];
  onSavePlan: (plan: Partial<FamilyPlan>) => Promise<any>;
  onDeletePlan: (id: string) => Promise<any>;
}

export function Schedules({
  currentUser,
  users,
  plans,
  onSavePlan,
  onDeletePlan
}: SchedulesProps) {
  const [viewMode, setViewMode] = useState<"list" | "board">("board"); // 'list' = agenda, 'board' = monthly style grid
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingPlan, setViewingPlan] = useState<FamilyPlan | null>(null);
  const [editingPlan, setEditingPlan] = useState<FamilyPlan | null>(null);
  const [formError, setFormError] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  // Filters
  const [filterSharedOnly, setFilterSharedOnly] = useState<"all" | "shared" | "personal">("all");

  // Form Fields
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newRecurrenceType, setNewRecurrenceType] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [newIsShared, setNewIsShared] = useState(true);
  const [newColor, setNewColor] = useState("sky");

  const canManagePlan = (plan: FamilyPlan) => {
    return currentUser.role === UserRole.ADMIN ||
      (currentUser.role === UserRole.MEMBER && plan.creatorId === currentUser.id);
  };

  const resetPlanForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewStartDate("");
    setNewEndDate("");
    setNewIsRecurring(false);
    setNewRecurrenceType("none");
    setNewIsShared(true);
    setNewColor("sky");
  };

  const handleOpenCreatePlan = () => {
    resetPlanForm();
    setEditingPlan(null);
    setFormError("");
    setIsFormOpen(true);
  };

  const handleOpenEditPlan = (plan: FamilyPlan) => {
    if (!canManagePlan(plan)) return;

    setNewTitle(plan.title);
    setNewDesc(plan.description || "");
    setNewStartDate(plan.startDate || "");
    setNewEndDate(plan.endDate || plan.startDate || "");
    setNewIsRecurring(plan.isRecurring);
    setNewRecurrenceType(plan.recurrenceType || "none");
    setNewIsShared(plan.isShared);
    setNewColor(plan.color || "sky");
    setEditingPlan(plan);
    setFormError("");
    setViewingPlan(null);
    setIsFormOpen(true);
  };

  const handleClosePlanForm = () => {
    setIsFormOpen(false);
    setEditingPlan(null);
    setFormError("");
  };

  // Escape-to-close + scroll lock + focus trap for the detail & form modals
  const viewingRef = React.useRef<HTMLDivElement | null>(null);
  const formRef = React.useRef<HTMLDivElement | null>(null);
  const closeViewing = useCallback(() => setViewingPlan(null), []);
  const closeForm = useCallback(() => { setIsFormOpen(false); setEditingPlan(null); setFormError(""); }, []);
  useModalA11y(!!viewingPlan, closeViewing, viewingRef);
  useModalA11y(isFormOpen, closeForm, formRef);

  // Filter plans according to user permission and filters
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      // Shared scope filters
      if (filterSharedOnly === "shared" && !p.isShared) return false;
      if (filterSharedOnly === "personal" && p.isShared) return false;

      // Limited viewers (Child & Guest) only see shared events + their own
      if (isLimitedViewer(currentUser.role) && !p.isShared && p.creatorId !== currentUser.id) {
        return false;
      }

      // Personal plan protection: only see if created by me or shared with everyone
      if (!p.isShared && p.creatorId !== currentUser.id && currentUser.role !== UserRole.ADMIN) {
        return false;
      }

      return true;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [plans, filterSharedOnly, currentUser]);

  // Calendar cursor — user can browse to any month/year (e.g. plans half a year / a year ahead)
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
  const calMonthName = new Date(calYear, calMonth, 1).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  const isViewingToday = calYear === today.getFullYear() && calMonth === today.getMonth();

  const goToPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const goToNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };
  const goToToday = () => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); };

  // Year options span a few years back and several ahead for forward planning
  const yearOptions = Array.from({ length: 10 }, (_, i) => today.getFullYear() - 3 + i);

  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(calYear, calMonth, 1).getDay(); // 0=Sunday
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days: { blank: boolean; dayNum: number }[] = [];
    for (let b = 0; b < firstWeekday; b++) {
      days.push({ blank: true, dayNum: 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ blank: false, dayNum: d });
    }
    return days;
  }, [calYear, calMonth]);

  // Map plans to EVERY day in their range (start..end) that falls in the current month
  const plansByDayNum = useMemo(() => {
    const mapping: Record<number, FamilyPlan[]> = {};
    filteredPlans.forEach(plan => {
      const startStr = plan.startDate.slice(0, 10);
      const endStr = (plan.endDate || plan.startDate).slice(0, 10);
      const start = new Date(`${startStr}T00:00:00`);
      const endParsed = new Date(`${endStr}T00:00:00`);
      if (isNaN(start.getTime())) return;
      const last = isNaN(endParsed.getTime()) || endParsed < start ? start : endParsed;

      const cur = new Date(start);
      let guard = 0;
      while (cur <= last && guard < 370) {
        if (cur.getFullYear() === calYear && cur.getMonth() === calMonth) {
          const dayNum = cur.getDate();
          if (!mapping[dayNum]) mapping[dayNum] = [];
          mapping[dayNum].push(plan);
        }
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
    });
    return mapping;
  }, [filteredPlans, calYear, calMonth]);

  // Birthdays falling in the current calendar month
  const birthdaysByDayNum = useMemo(() => {
    const map: Record<number, { id: string; name: string }[]> = {};
    users.forEach(u => {
      if (!u.dateOfBirth) return;
      const dob = new Date(u.dateOfBirth);
      if (isNaN(dob.getTime()) || dob.getMonth() !== calMonth) return;
      const day = dob.getDate();
      if (!map[day]) map[day] = [];
      map[day].push({ id: u.id, name: u.fullName });
    });
    return map;
  }, [users, calMonth]);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newTitle.trim()) {
      setFormError("Vui lòng điền tên kế hoạch sinh hoạt!");
      return;
    }
    if (!newStartDate.trim()) {
      setFormError("Vui lòng điền mốc ngày bắt đầu!");
      return;
    }

    const payload: Partial<FamilyPlan> = {
      id: editingPlan?.id,
      title: newTitle.trim(),
      description: newDesc.trim(),
      startDate: newStartDate.trim(),
      endDate: newEndDate.trim() || newStartDate.trim(),
      isRecurring: newIsRecurring,
      recurrenceType: newIsRecurring ? newRecurrenceType : "none",
      isShared: newIsShared,
      color: newColor
    };

    try {
      await onSavePlan(payload);
      resetPlanForm();
      setEditingPlan(null);
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || (editingPlan ? "Cập nhật sự kiện thất bại" : "Tạo kế hoạch thất bại"));
    }
  };

  const handleDeleteClick = async (planId: string) => {
    const ok = await confirm({
      title: "Xóa sự kiện khỏi lịch?",
      message: "Sự kiện này sẽ bị xóa khỏi lịch gia đình. Bạn có chắc chắn muốn tiếp tục không?",
      confirmLabel: "Xóa sự kiện",
      cancelLabel: "Đóng lại",
      tone: "danger"
    });
    if (!ok) return;

    await onDeletePlan(planId);
    if (viewingPlan?.id === planId) setViewingPlan(null);
  };

  // --- Add to phone calendar (.ics export) ---
  // Works on iOS (opens Apple Calendar) and Android (offers Google Calendar)
  // by downloading a standard iCalendar file. Times are "floating" local time
  // so the event lands at the same wall-clock time the user entered.
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const parsePlanDate = (s: string) => {
    const [datePart, timePart] = (s || "").trim().split(" ");
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return null;
    if (!timePart) return { date: new Date(y, m - 1, d), allDay: true };
    const [hh, mm] = timePart.split(":").map(Number);
    return { date: new Date(y, m - 1, d, hh || 0, mm || 0), allDay: false };
  };

  const fmtICSLocal = (dt: Date) =>
    `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`;
  const fmtICSDate = (dt: Date) =>
    `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}`;

  const escapeICS = (str: string) =>
    (str || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");

  const buildICS = (plan: FamilyPlan) => {
    const start = parsePlanDate(plan.startDate);
    if (!start) return null;
    const endRaw = plan.endDate && plan.endDate.trim() ? plan.endDate : plan.startDate;
    const end = parsePlanDate(endRaw) || start;

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Family Organizer//Schedules//VI",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${plan.id}@family-organizer`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    ];

    if (start.allDay) {
      // All-day event: DTEND is exclusive, so add one day to the last day.
      const endBase = end.date >= start.date ? new Date(end.date) : new Date(start.date);
      endBase.setDate(endBase.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${fmtICSDate(start.date)}`);
      lines.push(`DTEND;VALUE=DATE:${fmtICSDate(endBase)}`);
    } else {
      let endDt: Date;
      if (!end.allDay && end.date > start.date) {
        endDt = end.date;
      } else {
        endDt = new Date(start.date);
        endDt.setHours(endDt.getHours() + 1); // default 1h duration
      }
      lines.push(`DTSTART:${fmtICSLocal(start.date)}`);
      lines.push(`DTEND:${fmtICSLocal(endDt)}`);
    }

    lines.push(`SUMMARY:${escapeICS(plan.title)}`);
    if (plan.description) lines.push(`DESCRIPTION:${escapeICS(plan.description)}`);
    if (plan.isRecurring && plan.recurrenceType && plan.recurrenceType !== "none") {
      const freq = plan.recurrenceType === "daily" ? "DAILY" : plan.recurrenceType === "weekly" ? "WEEKLY" : "MONTHLY";
      lines.push(`RRULE:FREQ=${freq}`);
    }
    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.join("\r\n");
  };

  const handleAddToCalendar = (plan: FamilyPlan) => {
    const ics = buildICS(plan);
    if (!ics) return;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(plan.title || "su-kien").replace(/[^a-z0-9]/gi, "_").slice(0, 40) || "su-kien"}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Color schemas
  const badgeColorClass = (color: string) => {
    switch (color) {
      case "emerald": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "rose": return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "amber": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default: return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
    }
  };

  const borderLeftColor = (color: string) => {
    switch (color) {
      case "emerald": return "border-l-4 border-emerald-500";
      case "rose": return "border-l-4 border-rose-500";
      case "amber": return "border-l-4 border-amber-500";
      default: return "border-l-4 border-sky-500";
    }
  };

  const colorBulletClass = (color: string) => {
    switch (color) {
      case "emerald": return "bg-emerald-500";
      case "rose": return "bg-rose-500";
      case "amber": return "bg-amber-500";
      default: return "bg-sky-500";
    }
  };

  return (
    <div className="space-y-6" id="schedules-module">
      
      {/* Filters and mode change panel */}
      <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4" id="plans-control-header">
        
        {/* Toggle shared scopes buttons */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto gap-1 text-xs">
          <button 
            onClick={() => setFilterSharedOnly("all")}
            className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all ${filterSharedOnly === "all" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            Tất cả kế hoạch
          </button>
          <button 
            onClick={() => setFilterSharedOnly("shared")}
            className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all ${filterSharedOnly === "shared" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            Chung cả nhà
          </button>
          <button 
            onClick={() => setFilterSharedOnly("personal")}
            className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all ${filterSharedOnly === "personal" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            Việc riêng cá nhân
          </button>
        </div>

        {/* Layout Mode selection & add button */}
        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          {/* View toggle */}
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1">
            <button 
              onClick={() => setViewMode("board")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "board" ? "bg-slate-800 text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
              title="Xem dạng Lịch tháng"
            >
              <LayoutGrid className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "list" ? "bg-slate-800 text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
              title="Xem dạng Danh sách thời gian"
            >
              <LayoutList className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* New register event button */}
          <button 
            disabled={currentUser.role === UserRole.GUEST}
            onClick={handleOpenCreatePlan}
            className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all shadow-md shadow-sky-500/5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Lên lịch sự kiện
          </button>
        </div>
      </div>

      {/* Main View Display AREA */}
      {viewMode === "board" ? (
        /* Monthly style responsive Grid */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden" id="calendar-monthly-grid-view">
          
          <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 capitalize">
              <CalendarIcon className="w-5 h-5 text-amber-400 shrink-0" />
              {calMonthName}
            </h3>

            {/* Month / year navigation */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {!isViewingToday && (
                <button
                  type="button"
                  onClick={goToToday}
                  className="mr-1 px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Hôm nay
                </button>
              )}
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label="Tháng trước"
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-sky-400 rounded-lg cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={calMonth}
                onChange={(e) => setCalMonth(Number(e.target.value))}
                aria-label="Chọn tháng"
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, m) => (
                  <option key={m} value={m}>Tháng {m + 1}</option>
                ))}
              </select>

              <select
                value={calYear}
                onChange={(e) => setCalYear(Number(e.target.value))}
                aria-label="Chọn năm"
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer font-mono"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Tháng sau"
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-sky-400 rounded-lg cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 border-b border-slate-800 text-center bg-slate-950/40 text-[11px] text-slate-500 font-bold py-2.5">
            <div>Chủ Nhật</div>
            <div>Thứ Hai</div>
            <div>Thứ Ba</div>
            <div>Thứ Tư</div>
            <div>Thứ Năm</div>
            <div>Thứ Sáu</div>
            <div>Thứ Bảy</div>
          </div>

          {/* 30 block spaces */}
          <div className="grid grid-cols-7 md:auto-rows-[110px] auto-rows-[80px] bg-slate-900">
            {calendarDays.map((day, i) => {
              if (day.blank) {
                return <div key={`blank-${i}`} className="bg-slate-950/25 border-r border-b border-slate-800/60" />;
              }

              const dayPlans = plansByDayNum[day.dayNum] || [];
              const dayBirthdays = birthdaysByDayNum[day.dayNum] || [];
              const hasEvents = dayPlans.length > 0 || dayBirthdays.length > 0;
              const isToday = isViewingToday && day.dayNum === today.getDate();

              return (
                <div
                  key={`day-${day.dayNum}`}
                  className={`p-1.5 border-r border-b border-slate-800/80 hover:bg-slate-800/10 transition-colors flex flex-col justify-between overflow-hidden ${isToday ? "bg-sky-500/5" : ""}`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-[11px] font-semibold font-mono ${isToday ? "bg-sky-500 text-slate-950 px-1.5 rounded-md" : "text-slate-400"}`}>{day.dayNum}</span>
                    {hasEvents && (
                      <span className="w-2 h-2 shrink-0 rounded-full bg-sky-400 animate-pulse" />
                    )}
                  </div>

                  {/* Event + birthday badges */}
                  <div className="space-y-1 overflow-y-auto max-h-[80%] pr-0.5 scrollbar-none">
                    {dayBirthdays.map(b => (
                      <div
                        key={`bd-${b.id}`}
                        title={`🎂 Sinh nhật ${b.name}`}
                        className="text-[9px] px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1 bg-pink-500/10 text-pink-400 border border-pink-500/20"
                      >
                        <span className="shrink-0">🎂</span>
                        <span className="truncate">{b.name}</span>
                      </div>
                    ))}
                    {dayPlans.map(plan => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setViewingPlan(plan)}
                        title={`${plan.title}\n(${plan.startDate} → ${plan.endDate || plan.startDate})`}
                        className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${badgeColorClass(plan.color)}`}
                      >
                        <span className="shrink-0 text-[8px] font-mono opacity-80">{plan.startDate.split(" ")[1]}</span>
                        <span className="truncate">{plan.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agenda List View Details list */
        <div className="space-y-3" id="calendar-agenda-list-view">
          {filteredPlans.length === 0 ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center">
              <p className="text-sm text-slate-500">Chưa ghi nhận kế hoạch sinh hoạt gia đình nào phù hợp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlans.map(plan => {
                const creator = users.find(u => u.id === plan.creatorId);
                const canManage = canManagePlan(plan);
                const sDate = plan.startDate.split(" ");
                const eDate = plan.endDate.split(" ");
                return (
                  <div 
                    key={plan.id}
                    className={`bg-slate-900 border border-slate-800 ${borderLeftColor(plan.color)} rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-md relative group`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg ${badgeColorClass(plan.color)} font-semibold`}>
                          {plan.color === "emerald" ? "Dã ngoại / Ăn chơi" : plan.color === "rose" ? "Quan trọng" : plan.color === "amber" ? "Bài học / Công việc" : "Họp hành / Gặp mặt"}
                        </span>
                        
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                          {plan.isShared ? <Eye className="w-3.5 h-3.5 text-sky-400" /> : <Lock className="w-3.5 h-3.5 text-indigo-400" />}
                          <span>{plan.isShared ? "Công khai" : "Bản thân"}</span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-200">{plan.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">{plan.description || "Không có ghi chú thêm."}</p>
                    </div>

                    {/* Timeline line details */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500/80" />
                        <div className="flex flex-col">
                          <span>Bắt đầu: {sDate[0]} <span className="text-amber-400/90 text-[10px]">{sDate[1]}</span></span>
                          {plan.endDate && <span>Kết thúc: {eDate[0]} <span className="text-indigo-400/90 text-[10px]">{eDate[1]}</span></span>}
                        </div>
                      </div>

                      {/* Recurrence Indicator */}
                      {plan.isRecurring && (
                        <span className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 text-[10px] px-1.5 py-0.5 border border-indigo-500/20 rounded-md">
                          <Repeat className="w-3 h-3 animate-spin" /> {plan.recurrenceType === "daily" ? "Hằng ngày" : plan.recurrenceType === "weekly" ? "Hằng tuần" : "Hằng tháng"}
                        </span>
                      )}
                    </div>

                    {/* Add to phone calendar (.ics — works on iOS & Android) */}
                    <button
                      type="button"
                      onClick={() => handleAddToCalendar(plan)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg font-semibold text-[11px] transition-all cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" /> Thêm vào lịch điện thoại
                    </button>

                    {/* Creator mark */}
                    <div className="text-[10px] text-slate-500 pt-1 text-right flex items-center justify-end gap-1 font-sans">
                      <span>Lập bởi: {creator ? creator.fullName : "Thành viên"}</span>
                    </div>

                    {/* Owner/Admin actions */}
                    {canManage && (
                      <div className="absolute right-3.5 top-3.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          aria-label={`Sửa sự kiện ${plan.title}`}
                          onClick={() => handleOpenEditPlan(plan)}
                          className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:text-amber-400 text-slate-500 rounded-lg cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa sự kiện ${plan.title}`}
                          onClick={() => handleDeleteClick(plan.id)}
                          className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:text-rose-400 text-slate-500 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Creation Modal */}
      {/* Event detail viewer (click an event on the calendar) */}
      {viewingPlan && (() => {
        const creator = users.find(u => u.id === viewingPlan.creatorId);
        const canManage = canManagePlan(viewingPlan);
        return (
          <div
            onClick={() => setViewingPlan(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          >
            <motion.div
              ref={viewingRef}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className={`bg-slate-900 border border-slate-800 ${borderLeftColor(viewingPlan.color)} rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto outline-none`}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="space-y-1 min-w-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg ${badgeColorClass(viewingPlan.color)} font-semibold`}>
                    {viewingPlan.color === "emerald" ? "Dã ngoại / Ăn chơi" : viewingPlan.color === "rose" ? "Quan trọng" : viewingPlan.color === "amber" ? "Bài học / Công việc" : "Họp hành / Gặp mặt"}
                  </span>
                  <h3 className="text-md font-bold text-slate-100">{viewingPlan.title}</h3>
                </div>
                <button
                  type="button"
                  aria-label="Đóng chi tiết sự kiện"
                  onClick={() => setViewingPlan(null)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {viewingPlan.description || "Không có ghi chú thêm."}
              </p>

              <div className="space-y-2 bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                  <span className="text-slate-300">Bắt đầu: <span className="text-amber-400">{viewingPlan.startDate}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" />
                  <span className="text-slate-300">Kết thúc: <span className="text-indigo-400">{viewingPlan.endDate || viewingPlan.startDate}</span></span>
                </div>
                {viewingPlan.isRecurring && (
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Repeat className="w-3.5 h-3.5 shrink-0" />
                    <span>Lặp lại: {viewingPlan.recurrenceType === "daily" ? "Hằng ngày" : viewingPlan.recurrenceType === "weekly" ? "Hằng tuần" : "Hằng tháng"}</span>
                  </div>
                )}
              </div>

              {/* Add to the phone's native calendar (.ics — works on iOS & Android) */}
              <button
                type="button"
                onClick={() => handleAddToCalendar(viewingPlan)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md shadow-sky-500/10"
              >
                <CalendarPlus className="w-4 h-4" /> Thêm vào lịch điện thoại
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-[11px] text-slate-500 font-sans">
                <span className="flex items-center gap-1.5">
                  {viewingPlan.isShared ? <Eye className="w-3.5 h-3.5 text-sky-400" /> : <Lock className="w-3.5 h-3.5 text-indigo-400" />}
                  {viewingPlan.isShared ? "Công khai" : "Riêng tư"} • Lập bởi {creator ? creator.fullName : "Thành viên"}
                </span>
                <div className="flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewingPlan(null)}
                    className="px-3 py-1.5 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800 rounded-lg font-semibold cursor-pointer"
                  >
                    Đóng lại
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditPlan(viewingPlan)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg font-semibold cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Sửa
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteClick(viewingPlan.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {isFormOpen && (
        <div 
          onClick={handleClosePlanForm}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id={editingPlan ? "plan-edit-modal" : "plan-create-modal"}
        >
          <motion.div
            ref={formRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800 shrink-0">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                <CalendarIcon className="w-5 h-5 text-sky-400" /> {editingPlan ? "Chỉnh sửa sự kiện" : "Đăng ký lịch trình sinh hoạt"}
              </h3>
              <button
                type="button"
                aria-label="Đóng form lịch trình"
                onClick={handleClosePlanForm}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="flex flex-col min-h-0 flex-1 overflow-hidden text-xs">
              <div className="space-y-4 overflow-y-auto px-5 py-4 flex-1 min-h-0">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Tên sự kiện / Lịch trình <span className="text-rose-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Cơm tối nhà nội, Đi tiêm phòng cho con..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Ghi chú lưu ý thêm</label>
                <textarea 
                  rows={2}
                  placeholder="Chuẩn bị quà cáp, tài liệu, tiền lẻ hoặc phương tiện di chuyển..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <label className="text-slate-400 block font-semibold">Bắt đầu <span className="text-rose-400">*</span></label>
                  <DateTimePicker24 value={newStartDate} onChange={setNewStartDate} required />
                </div>

                <div className="space-y-1 min-w-0">
                  <label className="text-slate-400 block font-semibold">Kết thúc</label>
                  <DateTimePicker24 value={newEndDate} onChange={setNewEndDate} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Xảy ra định kỳ</label>
                  <select 
                    value={newIsRecurring ? "true" : "false"}
                    onChange={(e) => setNewIsRecurring(e.target.value === "true")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="false">Chỉ xảy ra một lần</option>
                    <option value="true">Sự kiện có lặp lại</option>
                  </select>
                </div>

                {newIsRecurring && (
                  <div className="space-y-1 font-mono">
                    <label className="text-slate-400 block font-semibold">Tần suất lặp lại</label>
                    <select 
                      value={newRecurrenceType}
                      onChange={(e) => setNewRecurrenceType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="daily">Hằng ngày</option>
                      <option value="weekly">Hằng tuần</option>
                      <option value="monthly">Hằng tháng</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <label className="text-slate-400 block font-semibold">Phạm vi chia sẻ</label>
                  <select 
                    value={newIsShared ? "true" : "false"}
                    onChange={(e) => setNewIsShared(e.target.value === "true")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="true">Công khai cả nhà cùng thấy</option>
                    <option value="false">Riêng tư cá nhân</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Màu sắc chủ đạo</label>
                  <div className="flex gap-2.5 pt-1.5">
                    {["sky", "emerald", "rose", "amber"].map(c => (
                      <button 
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        className={`w-6 h-6 rounded-full cursor-pointer flex items-center justify-center border-2 ${newColor === c ? "border-slate-100" : "border-transparent"}`}
                        style={{ backgroundColor: c === "sky" ? "#38bdf8" : c === "emerald" ? "#10b981" : c === "rose" ? "#f43f5e" : "#f59e0b" }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={handleClosePlanForm}
                  className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Đóng lại
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all cursor-pointer"
                >
                  {editingPlan ? "Lưu thay đổi" : "Lưu kế hoạch"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
