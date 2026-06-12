/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Clock, 
  Repeat, 
  Lock, 
  Eye, 
  Tag, 
  LayoutList, 
  LayoutGrid, 
  X
} from "lucide-react";
import { FamilyPlan, User, UserRole } from "../types.js";
import { motion, AnimatePresence } from "motion/react";

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
  const [formError, setFormError] = useState("");

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

  // Filter plans according to user permission and filters
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      // Shared scope filters
      if (filterSharedOnly === "shared" && !p.isShared) return false;
      if (filterSharedOnly === "personal" && p.isShared) return false;

      // Guest role validation: guest only sees shared plans
      if (currentUser.role === UserRole.GUEST && !p.isShared && p.creatorId !== currentUser.id) {
        return false;
      }

      // Personal plan protection: only see if created by me or shared with everyone
      if (!p.isShared && p.creatorId !== currentUser.id && currentUser.role !== UserRole.ADMIN) {
        return false;
      }

      return true;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [plans, filterSharedOnly, currentUser]);

  // Dynamic current-month calendar
  const today = new Date();
  const todayNum = today.getDate();
  const calYear = today.getFullYear();
  const calMonth = today.getMonth(); // 0-indexed
  const calMonthName = today.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  const calMonthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;

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

  // Map plans to day numbers for the current month
  const plansByDayNum = useMemo(() => {
    const mapping: Record<number, FamilyPlan[]> = {};
    filteredPlans.forEach(plan => {
      const dateStr = plan.startDate.slice(0, 10);
      if (dateStr.startsWith(calMonthPrefix)) {
        const dayNum = parseInt(dateStr.slice(8, 10), 10);
        if (!isNaN(dayNum)) {
          if (!mapping[dayNum]) mapping[dayNum] = [];
          mapping[dayNum].push(plan);
        }
      }
    });
    return mapping;
  }, [filteredPlans, calMonthPrefix]);

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

  const handleCreatePlan = async (e: React.FormEvent) => {
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
      // Reset
      setNewTitle("");
      setNewDesc("");
      setNewStartDate("");
      setNewEndDate("");
      setNewIsRecurring(false);
      setNewRecurrenceType("none");
      setNewIsShared(true);
      setNewColor("sky");
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Tạo kế hoạch thất bại");
    }
  };

  const handleDeleteClick = async (planId: string) => {
    if (confirm("Gia đình có chắc muốn xóa lịch sinh hoạt này khỏi hệ thống không?")) {
      await onDeletePlan(planId);
    }
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
            onClick={() => {
              setFormError("");
              setIsFormOpen(true);
            }}
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
          
          <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-amber-400" />
              {calMonthName} (Kế hoạch Gia đình)
            </h3>
            <span className="text-slate-500 text-[11px] font-mono">Dựa trên múi giờ thiết bị</span>
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
              const isToday = day.dayNum === todayNum;

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
                      <div
                        key={plan.id}
                        title={`${plan.title}\n(${plan.startDate.split(" ")[1]})`}
                        className={`text-[9px] px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1 ${badgeColorClass(plan.color)}`}
                      >
                        <span className="shrink-0 text-[8px] font-mono opacity-80">{plan.startDate.split(" ")[1]}</span>
                        <span className="truncate">{plan.title}</span>
                      </div>
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

                    {/* Creator mark */}
                    <div className="text-[10px] text-slate-500 pt-1 text-right flex items-center justify-end gap-1 font-sans">
                      <span>Lập bởi: {creator ? creator.fullName : "Thành viên"}</span>
                    </div>

                    {/* Trash capability */}
                    {currentUser.role !== UserRole.GUEST && (
                      <button 
                        onClick={() => handleDeleteClick(plan.id)}
                        className="absolute right-3.5 top-3.5 p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:text-rose-400 text-slate-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Creation Modal */}
      {isFormOpen && (
        <div 
          onClick={() => setIsFormOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="plan-create-modal"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                <CalendarIcon className="w-5 h-5 text-sky-400" /> Đăng ký lịch trình sinh hoạt
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Bắt đầu <span className="text-rose-400">*</span></label>
                  <input 
                    type="text" 
                    placeholder="YYYY-MM-DD HH:mm (Ví dụ: 2026-06-12 18:30)"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Kết thúc</label>
                  <input 
                    type="text" 
                    placeholder="YYYY-MM-DD HH:mm (Ví dụ: 2026-06-12 21:00)"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Xảy ra định kỳ</label>
                  <select 
                    value={newIsRecurring ? "true" : "false"}
                    onChange={(e) => setNewIsRecurring(e.target.value === "true")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="false font-mono">Chỉ xảy ra một lần</option>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Phạm vi chia sẻ</label>
                  <select 
                    value={newIsShared ? "true" : "false"}
                    onChange={(e) => setNewIsShared(e.target.value === "true")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="true">Công khai cả nhà cùng thấy</option>
                    <option value="false font-mono">Riêng tư cá nhân</option>
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

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Đóng lại
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Lưu kế hoạch
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
