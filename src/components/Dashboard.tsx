/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  CheckSquare,
  Calendar,
  FileText,
  TrendingDown,
  TrendingUp,
  Wallet,
  Activity,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Cake
} from "lucide-react";
import { Task, FamilyPlan, Note, FinancialTransaction, User, TaskStatus } from "../types.js";
import { motion } from "motion/react";
import { Avatar } from "./Avatar.js";

interface DashboardProps {
  currentUser: User;
  users: User[];
  tasks: Task[];
  plans: FamilyPlan[];
  notes: Note[];
  transactions: FinancialTransaction[];
  activityLogs: any[];
  widgets: any;
  onNavigate: (tab: string) => void;
}

// WMO weather code → Vietnamese label + emoji
const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Trời quang", icon: "☀️" },
  1: { label: "Ít mây", icon: "🌤️" },
  2: { label: "Có mây", icon: "⛅" },
  3: { label: "Nhiều mây", icon: "☁️" },
  45: { label: "Sương mù", icon: "🌫️" },
  48: { label: "Sương muối", icon: "🌫️" },
  51: { label: "Mưa phùn nhẹ", icon: "🌦️" },
  53: { label: "Mưa phùn", icon: "🌦️" },
  55: { label: "Mưa phùn dày", icon: "🌧️" },
  61: { label: "Mưa nhẹ", icon: "🌦️" },
  63: { label: "Mưa vừa", icon: "🌧️" },
  65: { label: "Mưa to", icon: "🌧️" },
  80: { label: "Mưa rào", icon: "🌦️" },
  81: { label: "Mưa rào", icon: "🌧️" },
  82: { label: "Mưa rào dữ dội", icon: "⛈️" },
  95: { label: "Dông", icon: "⛈️" },
  96: { label: "Dông kèm mưa đá", icon: "⛈️" },
  99: { label: "Dông mạnh", icon: "⛈️" }
};
const describeWeather = (code: number) => WEATHER_CODES[code] || { label: "—", icon: "🌡️" };

// Smoothly counts from the previous value up to the target (easeOutCubic).
function useCountUp(target: number | null | undefined, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (target === null || target === undefined || isNaN(target)) return;
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      setDisplay(current);
      fromRef.current = current;
      if (t < 1) raf = requestAnimationFrame(tick);
      else { fromRef.current = target; setDisplay(target); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

// Renders a number that rolls up to its value once data arrives.
function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const display = useCountUp(value);
  return <>{format(display)}</>;
}

// Pulsing placeholder shown in a widget slot while its data is still loading.
const Skeleton = ({ className = "" }: { className?: string }) => (
  <span className={`inline-block bg-slate-700/40 rounded-md animate-pulse align-middle ${className}`} />
);

export function Dashboard({
  currentUser,
  users,
  tasks,
  plans,
  notes,
  transactions,
  activityLogs,
  widgets,
  onNavigate
}: DashboardProps) {
  // 1. Task calculations
  const myTasks = useMemo(() => {
    return tasks.filter(t => t.assigneeId === currentUser.id);
  }, [tasks, currentUser.id]);

  const urgentTasksCount = useMemo(() => {
    return tasks.filter(t => t.status !== TaskStatus.COMPLETED && t.priority === "high").length;
  }, [tasks]);

  const myRemainingTasks = useMemo(() => {
    return myTasks.filter(t => t.status !== TaskStatus.COMPLETED);
  }, [myTasks]);

  // 2. Financial calculations (this month)
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const financialSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.date.startsWith(currentMonth)) {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
      }
    });
    return { income, expense, balance: income - expense };
  }, [transactions, currentMonth]);

  // 3. Upcoming schedule events (next 20 days)
  const upcomingPlans = useMemo(() => {
    const now = new Date();
    const threshold = new Date(Date.now() + 86400000 * 20);
    return plans
      .filter(p => {
        const pDate = new Date(p.startDate.replace(" ", "T"));
        return pDate >= now && pDate <= threshold;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 8);
  }, [plans]);

  // 4. Pinned notes
  const pinnedNotes = useMemo(() => {
    return notes.filter(n => n.isPinned).slice(0, 3);
  }, [notes]);

  // 5. Upcoming birthdays (next 30 days)
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return users
      .filter(u => u.dateOfBirth)
      .map(u => {
        const dob = new Date(u.dateOfBirth as string);
        if (isNaN(dob.getTime())) return null;
        let bday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (bday.getTime() < todayMid) {
          bday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        }
        const daysUntil = Math.round((bday.getTime() - todayMid) / 86400000);
        return {
          user: u,
          daysUntil,
          turningAge: bday.getFullYear() - dob.getFullYear(),
          month: dob.getMonth() + 1,
          day: dob.getDate()
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [users]);

  // Welcome Greeting
  const welcomeMessage = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return "Chào buổi sáng, chúc gia đình ngày mới an lành! ☀️";
    if (hours < 18) return "Chào buổi chiều, chúc gia đình làm việc hiệu quả! 🌤️";
    return "Chúc gia đình buổi tối ấm áp và thư giãn! 🌙";
  }, []);

  // Widget formatting helpers
  const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  const fmtVnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
  const changeBadge = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined || isNaN(pct)) return null;
    const up = pct >= 0;
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${up ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="space-y-6" id="dashboard-tab">
      {/* Greetings Block */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-radial from-slate-800 to-slate-900 border border-slate-700/60 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        id="dashboard-header-banner"
      >
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            Xin chào, <span className="text-sky-400 font-semibold">{currentUser.fullName}</span>!
          </h2>
          <p className="text-slate-400 text-sm md:text-base">{welcomeMessage}</p>
        </div>
        <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/50 flex items-center gap-3 self-start md:self-auto text-xs md:text-sm font-mono text-slate-300">
          <Clock className="w-4 h-4 text-sky-400 animate-pulse" />
          <span>{new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </motion.div>

      {/* Weather + Markets widgets — always rendered (skeleton while loading) to avoid layout shift */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" id="dashboard-widgets">

        {/* Weather */}
        {(() => {
          const w = widgets?.weather;
          const hasW = !!w?.current;
          const cur = hasW ? describeWeather(w.current.weather_code) : null;
          return (
            <div className="lg:col-span-1 bg-gradient-to-br from-sky-500/10 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col min-h-[188px]">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-semibold truncate">{hasW ? w.city : "Thời tiết"}</p>
                  {hasW ? (
                    <p className="text-3xl font-extrabold text-slate-100 mt-1">
                      <AnimatedNumber value={w.current.temperature_2m} format={(n) => `${Math.round(n)}°C`} />
                    </p>
                  ) : (
                    <Skeleton className="h-8 w-24 mt-1.5" />
                  )}
                  {hasW ? (
                    <p className="text-xs text-slate-400 mt-0.5">{cur!.label} • Cảm giác {Math.round(w.current.apparent_temperature)}°</p>
                  ) : (
                    <Skeleton className="h-3 w-32 mt-2" />
                  )}
                </div>
                <span className="text-4xl leading-none">{hasW ? cur!.icon : "🌡️"}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400">
                {hasW ? (
                  <>
                    <span>💧 Độ ẩm {w.current.relative_humidity_2m}%</span>
                    <span>💨 {Math.round(w.current.wind_speed_10m)} km/h</span>
                  </>
                ) : (
                  <Skeleton className="h-3 w-40" />
                )}
              </div>
              <div className="flex justify-between mt-3 gap-2">
                {hasW && w.daily?.time ? (
                  w.daily.time.slice(0, 3).map((d: string, i: number) => {
                    const dc = describeWeather(w.daily.weather_code[i]);
                    const dayLabel = i === 0 ? "Hôm nay" : new Date(d).toLocaleDateString("vi-VN", { weekday: "short" });
                    return (
                      <div key={d} className="flex-1 text-center bg-slate-950/40 rounded-lg py-2">
                        <p className="text-[10px] text-slate-500">{dayLabel}</p>
                        <p className="text-lg leading-tight">{dc.icon}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{Math.round(w.daily.temperature_2m_min[i])}°/{Math.round(w.daily.temperature_2m_max[i])}°</p>
                      </div>
                    );
                  })
                ) : (
                  [0, 1, 2].map(i => (
                    <div key={i} className="flex-1 bg-slate-950/40 rounded-lg py-2 flex flex-col items-center gap-1.5">
                      <Skeleton className="h-2 w-8" />
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-2 w-9" />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* Market mini-cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {/* Bitcoin */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400">₿ Bitcoin</span>
              {widgets?.crypto?.bitcoin ? changeBadge(widgets.crypto.bitcoin.usd_24h_change) : null}
            </div>
            <div className="mt-2">
              {widgets?.crypto?.bitcoin ? (
                <>
                  <p className="text-lg font-extrabold text-slate-100"><AnimatedNumber value={widgets.crypto.bitcoin.usd} format={fmtUsd} /></p>
                  <p className="text-[10px] text-slate-500 font-mono"><AnimatedNumber value={widgets.crypto.bitcoin.vnd} format={fmtVnd} /></p>
                </>
              ) : (
                <>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-2.5 w-20 mt-1.5" />
                </>
              )}
            </div>
          </div>

          {/* Ethereum */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400">Ξ Ethereum</span>
              {widgets?.crypto?.ethereum ? changeBadge(widgets.crypto.ethereum.usd_24h_change) : null}
            </div>
            <div className="mt-2">
              {widgets?.crypto?.ethereum ? (
                <>
                  <p className="text-lg font-extrabold text-slate-100"><AnimatedNumber value={widgets.crypto.ethereum.usd} format={fmtUsd} /></p>
                  <p className="text-[10px] text-slate-500 font-mono"><AnimatedNumber value={widgets.crypto.ethereum.vnd} format={fmtVnd} /></p>
                </>
              ) : (
                <>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-2.5 w-20 mt-1.5" />
                </>
              )}
            </div>
          </div>

          {/* Gold */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-yellow-500">🪙 {widgets?.gold?.source || "Vàng"}</span>
              {widgets?.gold ? changeBadge(widgets.gold.changePct) : null}
            </div>
            <div className="mt-2">
              {widgets?.gold && (widgets.gold.sell || widgets.gold.vndPerTael || widgets.gold.usdPerOz) ? (
                widgets.gold.sell ? (
                  <>
                    <p className="text-base font-extrabold text-slate-100"><AnimatedNumber value={widgets.gold.sell} format={fmtVnd} /></p>
                    <p className="text-[10px] text-slate-500">Bán /lượng{widgets.gold.buy ? ` • Mua ${fmtVnd(widgets.gold.buy)}` : ""}</p>
                  </>
                ) : widgets.gold.vndPerTael ? (
                  <>
                    <p className="text-base font-extrabold text-slate-100"><AnimatedNumber value={widgets.gold.vndPerTael} format={fmtVnd} /></p>
                    <p className="text-[10px] text-slate-500">≈ /lượng (tham khảo)</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold text-slate-100"><AnimatedNumber value={widgets.gold.usdPerOz} format={fmtUsd} /><span className="text-[10px] text-slate-500"> /oz</span></p>
                    <p className="text-[10px] text-slate-500">Thế giới</p>
                  </>
                )
              ) : (
                <>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-2.5 w-20 mt-1.5" />
                </>
              )}
            </div>
          </div>

          {/* USD/VND */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">💵 USD/VND</span>
            </div>
            <div className="mt-2">
              {widgets?.fx?.usdVnd ? (
                <>
                  <p className="text-lg font-extrabold text-slate-100"><AnimatedNumber value={widgets.fx.usdVnd} format={fmtVnd} /></p>
                  <p className="text-[10px] text-slate-500">Tỷ giá 1 USD</p>
                </>
              ) : (
                <>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-2.5 w-20 mt-1.5" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-stats">
        {/* Card 1: My Remaining Tasks */}
        <div 
          onClick={() => onNavigate("tasks")} 
          className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          id="stat-my-tasks"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Task của tôi</span>
            <div className="bg-sky-500/10 p-2 rounded-xl text-sky-400 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-bold text-slate-100">{myRemainingTasks.length}</span>
            <p className="text-slate-500 text-xs mt-1">Đang cần giải quyết</p>
          </div>
        </div>

        {/* Card 2: Urgent Tasks */}
        <div 
          onClick={() => onNavigate("tasks")} 
          className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          id="stat-urgent-tasks"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Nhiệm vụ khẩn cấp</span>
            <div className="bg-rose-500/15 p-2 rounded-xl text-rose-400 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-5 h-5 animate-bounce" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-bold text-rose-400">{urgentTasksCount}</span>
            <p className="text-slate-500 text-xs mt-1">Mức ưu tiên cao</p>
          </div>
        </div>

        {/* Card 3: Cash balance this month */}
        <div 
          onClick={() => onNavigate("finance")} 
          className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          id="stat-monthly-balance"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Số dư tháng này</span>
            <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${financialSummary.balance >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-xl md:text-2xl font-bold ${financialSummary.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {financialSummary.balance.toLocaleString()}đ
            </span>
            <p className="text-slate-500 text-xs mt-1">Thu nhập trừ chi tiêu</p>
          </div>
        </div>

        {/* Card 4: Upcoming Schedule */}
        <div 
          onClick={() => onNavigate("plans")} 
          className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          id="stat-schedules"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Lịch 20 ngày tới</span>
            <div className="bg-amber-500/10 p-2 rounded-xl text-amber-400 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-bold text-slate-100">{upcomingPlans.length}</span>
            <p className="text-slate-500 text-xs mt-1">Sự kiện/Lịch trình</p>
          </div>
        </div>
      </div>

      {/* Main Dashboard Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-grid">
        
        {/* Left Column - Schedules & Notes (Col 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Upcoming Schedule */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-upcoming-plans">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Sự kiện sắp diễn ra
              </h3>
              <button 
                onClick={() => onNavigate("plans")} 
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 group"
              >
                Xem chi tiết 
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>

            {upcomingPlans.length === 0 ? (
              <div className="bg-slate-950/40 border border-dashed border-slate-800 p-6 rounded-xl text-center">
                <p className="text-sm text-slate-500">Không có kế hoạch quan trọng nào trong 20 ngày tới.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingPlans.map((plan, i) => {
                  const sDate = plan.startDate.split(" ");
                  const colorMap: any = {
                    emerald: "border-l-4 border-emerald-500 bg-emerald-500/5",
                    sky: "border-l-4 border-sky-500 bg-sky-500/5",
                    amber: "border-l-4 border-amber-500 bg-amber-500/5",
                    rose: "border-l-4 border-rose-500 bg-rose-500/5"
                  };
                  return (
                    <div 
                      key={plan.id}
                      className={`p-3 rounded-xl flex items-center justify-between ${colorMap[plan.color] || "border-l-5 border-slate-600 bg-slate-800/10"} hover:bg-slate-800/30 transition-all`}
                    >
                      <div className="space-y-0.5 max-w-[70%]">
                        <span className="text-sm font-semibold text-slate-200 block truncate">{plan.title}</span>
                        <p className="text-xs text-slate-500 truncate">{plan.description || "Không có miêu tả"}</p>
                      </div>
                      <div className="text-right flex flex-col justify-center shrink-0">
                        <span className="text-xs font-semibold text-slate-300">{sDate[0]}</span>
                        <span className="text-[10px] font-mono text-amber-400/80">{sDate[1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Birthdays */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-birthdays">
            <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
              <Cake className="w-5 h-5 text-pink-400" />
              Sinh nhật sắp tới
            </h3>

            {upcomingBirthdays.length === 0 ? (
              <div className="bg-slate-950/40 border border-dashed border-slate-800 p-6 rounded-xl text-center">
                <p className="text-sm text-slate-500">Chưa có sinh nhật nào trong 30 ngày tới. Thêm ngày sinh ở mục <span className="text-indigo-400 font-semibold">Thiết lập → Hồ sơ của tôi</span> để được nhắc nhé!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingBirthdays.map(b => (
                  <div key={b.user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:bg-slate-800/30 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar user={b.user} className="w-9 h-9 rounded-xl text-sm" extraClass="shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{b.user.fullName}</p>
                        <p className="text-[11px] text-slate-500">Tròn {b.turningAge} tuổi • ngày {b.day}/{b.month}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${b.daysUntil === 0 ? "bg-pink-500/15 text-pink-400" : "bg-slate-800 text-slate-300"}`}>
                      {b.daysUntil === 0 ? "Hôm nay 🎉" : `Còn ${b.daysUntil} ngày`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Pinned Notes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-pinned-notes">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                Ghi chú gia đình nổi bật
              </h3>
              <button 
                onClick={() => onNavigate("notes")} 
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 group"
              >
                Tất cả ghi chú 
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>

            {pinnedNotes.length === 0 ? (
              <div className="bg-slate-950/40 border border-dashed border-slate-800 p-6 rounded-xl text-center">
                <p className="text-sm text-slate-500">Chưa có ghi chú nào được pin lên màn hình chính.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {pinnedNotes.map((note) => {
                  const creator = users.find(u => u.id === note.creatorId);
                  return (
                    <div 
                      key={note.id} 
                      onClick={() => onNavigate("notes")}
                      className="bg-slate-950 hover:bg-slate-800/40 border border-slate-800/80 p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between min-h-[140px] shadow-sm relative group"
                    >
                      <div className="space-y-1.5 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/10">Pinned</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-200 group-hover:text-sky-400 transition-colors line-clamp-1">{note.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-4 leading-relaxed font-sans">
                          {note.content.replace(/[#*`\-]/g, "")}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-500">
                        <span>{creator ? creator.fullName.split(" ")[0] : "Thành viên"}</span>
                        <span>{new Date(note.updatedAt).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Finances (Month Breakdown) & Activities Logger (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Recent Money Widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-finance-overview">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                Tài chính chi tiêu tháng {new Date().getMonth() + 1}
              </h3>
              <button 
                onClick={() => onNavigate("finance")} 
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 group"
              >
                Xem quỹ 
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>

            {/* Income-Expense mini comparison graph */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/50 space-y-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="space-y-1">
                  <span className="flex items-center gap-1 text-[11px]"><TrendingUp className="w-3 h-3 text-emerald-400" /> Tổng Thu</span>
                  <p className="text-sm font-bold text-slate-200">{financialSummary.income.toLocaleString()}đ</p>
                </div>
                <div className="text-right space-y-1">
                  <span className="flex items-center gap-1 justify-end text-[11px]"><TrendingDown className="w-3 h-3 text-rose-400" /> Tổng Chi</span>
                  <p className="text-sm font-bold text-slate-200">{financialSummary.expense.toLocaleString()}đ</p>
                </div>
              </div>

              {/* Graphical Bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  {financialSummary.income + financialSummary.expense > 0 ? (
                    <>
                      <div 
                        style={{ width: `${(financialSummary.income / (financialSummary.income + financialSummary.expense)) * 100}%` }}
                        className="h-full bg-emerald-500" 
                      />
                      <div 
                        style={{ width: `${(financialSummary.expense / (financialSummary.income + financialSummary.expense)) * 100}%` }}
                        className="h-full bg-rose-500" 
                      />
                    </>
                  ) : (
                    <div className="h-full w-full bg-slate-800" />
                  )}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>{financialSummary.income + financialSummary.expense > 0 ? `${Math.round(financialSummary.income / (financialSummary.income + financialSummary.expense) * 100)}% Thu` : "0% Thu"}</span>
                  <span>{financialSummary.income + financialSummary.expense > 0 ? `${Math.round(financialSummary.expense / (financialSummary.income + financialSummary.expense) * 100)}% Chi` : "0% Chi"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Logs inside family */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-activity-logs">
            <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Nhật ký gia đình
            </h3>

            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 max-h-[178px] overflow-y-auto space-y-2 font-mono scrollbar-thin">
              {activityLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">Chưa có hoạt động hệ thống.</div>
              ) : (
                activityLogs.map((log) => {
                  const formatTime = (isoString: string) => {
                    const d = new Date(isoString);
                    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                  };
                  return (
                    <div key={log.id} className="text-[11px] p-2 hover:bg-slate-900/50 rounded transition-all text-slate-300 border-l border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-500 text-[10px] pb-0.5">
                        <span className="font-semibold text-sky-400/90">@{log.username}</span>
                        <span>{formatTime(log.createdAt)}</span>
                      </div>
                      <span className="text-indigo-400 font-semibold">{log.action}: </span>
                      <span className="text-slate-400 font-sans">{log.details}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
