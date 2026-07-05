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
  Cake,
  MapPin,
  AlertTriangle,
  Droplets,
  Wind,
  Sun,
  CloudRain,
  Waves
} from "lucide-react";
import { Task, FamilyPlan, Note, FinancialTransaction, User, TaskStatus, MarketHistoryPoint } from "../types.js";
import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "./Avatar.js";
import { QuickNudge } from "./QuickNudge.js";
import { ShimmerLine, IconChip } from "./Lively.js";
import { FancySelect } from "./FancySelect.js";
import { VN_LOCATIONS } from "../utils/vnLocations.js";

interface DashboardProps {
  currentUser: User;
  users: User[];
  tasks: Task[];
  plans: FamilyPlan[];
  notes: Note[];
  transactions: FinancialTransaction[];
  activityLogs: any[];
  widgets: any;
  weatherLoc: string;
  onChangeWeatherLoc: (code: string) => void;
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

// "cách đây" gọn gàng cho mốc thời gian động đất (nhận epoch ms từ USGS).
const timeAgoVi = (ms: number | null | undefined): string => {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `${days} ngày trước`;
};

// Aurora look of the hero banner per time of day. Blob tints are fixed accents
// at low opacity so they read as soft pastels on the light theme and as glow on dark.
const AURORA = {
  morning: {
    message: "Chào buổi sáng, chúc gia đình ngày mới an lành! ☀️",
    blobs: ["bg-amber-400/25", "bg-rose-400/20", "bg-orange-300/20"],
    nameGradient: "from-amber-500 via-rose-500 to-orange-500",
    shimmer: "via-amber-500/60"
  },
  afternoon: {
    message: "Chào buổi chiều, chúc gia đình làm việc hiệu quả! 🌤️",
    blobs: ["bg-sky-500/20", "bg-cyan-400/20", "bg-violet-500/20"],
    nameGradient: "from-sky-500 via-violet-500 to-cyan-500",
    shimmer: "via-sky-500/60"
  },
  evening: {
    message: "Chúc gia đình buổi tối ấm áp và thư giãn! 🌙",
    blobs: ["bg-violet-500/25", "bg-fuchsia-500/15", "bg-indigo-500/25"],
    nameGradient: "from-violet-500 via-fuchsia-500 to-sky-500",
    shimmer: "via-violet-500/60"
  }
} as const;

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

// Sparkline + % tăng trưởng 7 ngày cho card giá (ẩn khi lịch sử chưa đủ 2 điểm).
function TrendRow({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const up = last >= first;
  const pct = first !== 0 ? ((last - first) / first) * 100 : 0;
  const W = 120, H = 30, pad = 2;
  const min = Math.min(...values);
  const range = (Math.max(...values) - min) || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((v - min) / range) * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = up ? "#34d399" : "#fb7185";
  return (
    <div className="mt-2 space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden>
        <polygon points={`${pad},${H - pad} ${pts.join(" ")} ${W - pad},${H - pad}`} fill={stroke} opacity="0.12" />
        <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className={`text-[9px] font-mono ${up ? "text-emerald-400" : "text-rose-400"}`}>
        {up ? "▲" : "▼"} {pct >= 0 ? "+" : ""}{pct.toFixed(1).replace(".", ",")}% · 7 ngày
      </p>
    </div>
  );
}

export function Dashboard({
  currentUser,
  users,
  tasks,
  plans,
  notes,
  transactions,
  activityLogs,
  widgets,
  weatherLoc,
  onChangeWeatherLoc,
  onNavigate
}: DashboardProps) {
  const reduceMotion = useReducedMotion();

  // Entrance animation preset: cards slide up in sequence; plain fade when the
  // user prefers reduced motion.
  const fadeUp = (delay = 0) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { type: "spring" as const, stiffness: 260, damping: 26, delay }
        };

  // Slow drift for the aurora blobs in the hero banner (disabled under reduced motion).
  const drift = (duration: number) =>
    reduceMotion
      ? {}
      : {
          animate: { x: [0, 24, -12, 0], y: [0, -18, 10, 0], scale: [1, 1.12, 0.94, 1] },
          transition: { duration, repeat: Infinity, ease: "easeInOut" as const }
        };

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
  const balancePositive = financialSummary.balance >= 0;
  const financeTotal = financialSummary.income + financialSummary.expense;
  const incomePct = financeTotal > 0 ? (financialSummary.income / financeTotal) * 100 : 0;
  const expensePct = financeTotal > 0 ? (financialSummary.expense / financeTotal) * 100 : 0;

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

  // Time of day drives both the greeting and the hero's aurora palette.
  const aurora = useMemo(() => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return AURORA.morning;
    if (hours >= 12 && hours < 18) return AURORA.afternoon;
    return AURORA.evening;
  }, []);

  // Chuỗi giá 7 ngày cho sparkline từng card (server chụp ~10 phút/lần).
  const marketSeries = useMemo(() => {
    const history: MarketHistoryPoint[] = widgets?.history || [];
    const pick = (key: "btcUsd" | "ethUsd" | "goldSell" | "usdVnd") =>
      history.map(p => p[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return { btc: pick("btcUsd"), eth: pick("ethUsd"), gold: pick("goldSell"), fx: pick("usdVnd") };
  }, [widgets?.history]);

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
      {/* Greetings Block — aurora hero that shifts palette with the time of day */}
      <motion.div
        {...fadeUp(0)}
        className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl"
        id="dashboard-header-banner"
      >
        {/* Aurora backdrop: three drifting blurred blobs + twinkling sparkles */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <motion.div {...drift(16)} className={`absolute -top-24 -left-16 w-64 h-64 rounded-full blur-3xl ${aurora.blobs[0]}`} />
          <motion.div {...drift(21)} className={`absolute -top-16 right-0 w-72 h-72 rounded-full blur-3xl ${aurora.blobs[1]}`} />
          <motion.div {...drift(26)} className={`absolute -bottom-28 left-1/3 w-72 h-72 rounded-full blur-3xl ${aurora.blobs[2]}`} />
          {!reduceMotion &&
            [
              { top: "18%", left: "38%", delay: 0 },
              { top: "62%", left: "56%", delay: 1.6 },
              { top: "28%", left: "82%", delay: 0.8 }
            ].map((s, i) => (
              <motion.span
                key={i}
                className="absolute text-slate-100/50 text-[10px] select-none"
                style={{ top: s.top, left: s.left }}
                animate={{ opacity: [0.1, 0.8, 0.1], scale: [0.7, 1.15, 0.7] }}
                transition={{ duration: 3.6, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
              >
                ✦
              </motion.span>
            ))}
        </div>
        <ShimmerLine via={aurora.shimmer} />

        <div className="relative p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar
              user={currentUser}
              className="w-12 h-12 md:w-14 md:h-14 rounded-2xl text-lg"
              extraClass="ring-2 ring-slate-800/80 shadow-lg"
            />
            <div className="space-y-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-100 truncate">
                Xin chào,{" "}
                <span className={`bg-gradient-to-r ${aurora.nameGradient} bg-clip-text text-transparent`}>
                  {currentUser.fullName}
                </span>
                !
              </h2>
              <p className="text-slate-400 text-sm md:text-base">{aurora.message}</p>
            </div>
          </div>
          <div className="bg-slate-950/60 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800/80 flex items-center gap-3 self-start md:self-auto text-xs md:text-sm font-mono text-slate-300 shrink-0">
            <Clock className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>{new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
        </div>
      </motion.div>

      {/* Quick nudge: send a notification (+ push) to a family member or everyone */}
      <motion.div {...fadeUp(0.06)}>
        <QuickNudge currentUser={currentUser} users={users} />
      </motion.div>

      {/* Weather + Markets widgets — always rendered (skeleton while loading) to avoid layout shift */}
      <motion.div {...fadeUp(0.12)} className="grid grid-cols-1 lg:grid-cols-3 gap-4" id="dashboard-widgets">

        {/* Weather */}
        {(() => {
          const w = widgets?.weather;
          const hasW = !!w?.current;
          const cur = hasW ? describeWeather(w.current.weather_code) : null;
          const uvToday = hasW && w.daily?.uv_index_max ? w.daily.uv_index_max[0] : null;
          const rainToday = hasW && w.daily?.precipitation_probability_max ? w.daily.precipitation_probability_max[0] : null;
          const storm = w?.stormRisk;
          const quakes = widgets?.quakes;
          const quakeList: any[] = quakes?.events || [];
          const stormStyle = storm?.level === "warning"
            ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
            : "bg-amber-500/15 border-amber-500/40 text-amber-300";
          return (
            <div className="relative overflow-hidden lg:col-span-1 bg-gradient-to-br from-sky-500/15 via-slate-900 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col min-h-[188px]">
              <ShimmerLine via="via-sky-500/60" />
              <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-sky-500/10 blur-2xl" />

              {/* Bộ chọn địa phương — mỗi người một cài đặt riêng */}
              <div className="relative flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="min-w-0 flex-1 max-w-[190px]">
                  <FancySelect
                    value={weatherLoc}
                    onChange={onChangeWeatherLoc}
                    ariaLabel="Chọn địa phương xem thời tiết"
                    options={VN_LOCATIONS.map(l => ({ value: l.code, label: l.name }))}
                  />
                </div>
              </div>

              <div className="relative flex items-start justify-between">
                <div className="min-w-0">
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

              {/* Chi tiết: độ ẩm, gió giật, tia UV, xác suất mưa */}
              <div className="relative grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-300">
                {hasW ? (
                  <>
                    <span className="inline-flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />Độ ẩm {w.current.relative_humidity_2m}%</span>
                    <span className="inline-flex items-center gap-1.5"><Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />Giật {Math.round(w.current.wind_gusts_10m ?? w.current.wind_speed_10m)} km/h</span>
                    {uvToday != null && <span className="inline-flex items-center gap-1.5"><Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />UV {Math.round(uvToday)}</span>}
                    {rainToday != null && <span className="inline-flex items-center gap-1.5"><CloudRain className="w-3.5 h-3.5 text-indigo-400 shrink-0" />Mưa {Math.round(rainToday)}%</span>}
                  </>
                ) : (
                  <Skeleton className="h-3 w-40 col-span-2" />
                )}
              </div>

              {/* Cảnh báo nguy cơ giông bão (ước lượng từ gió giật + mã dông) */}
              {hasW && storm && storm.level !== "none" && (
                <div className={`relative mt-3 rounded-lg border px-2.5 py-2 flex items-start gap-2 ${stormStyle}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold leading-tight">{storm.label}</p>
                    {storm.detail && <p className="text-[10px] opacity-80 leading-tight mt-0.5">{storm.detail} · ước lượng</p>}
                  </div>
                </div>
              )}

              <div className="relative flex justify-between mt-3 gap-2">
                {hasW && w.daily?.time ? (
                  w.daily.time.slice(0, 3).map((d: string, i: number) => {
                    const dc = describeWeather(w.daily.weather_code[i]);
                    const dayLabel = i === 0 ? "Hôm nay" : new Date(d).toLocaleDateString("vi-VN", { weekday: "short" });
                    return (
                      <div key={d} className="flex-1 text-center bg-slate-950/40 backdrop-blur-sm rounded-lg py-2 hover:bg-slate-950/60 transition-colors">
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

              {/* Động đất gần đây trong bán kính quanh địa phương (USGS) */}
              <div className="relative mt-3 pt-3 border-t border-slate-800/60">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-1.5">
                  <Waves className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  Động đất gần đây {quakes?.radiusKm ? `(bán kính ${quakes.radiusKm}km)` : ""}
                </div>
                {quakeList.length > 0 ? (
                  <div className="space-y-1">
                    {quakeList.slice(0, 2).map((q, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className={`font-mono font-bold shrink-0 ${q.mag >= 5 ? "text-rose-400" : q.mag >= 4 ? "text-amber-400" : "text-slate-300"}`}>M{Number(q.mag).toFixed(1)}</span>
                        <span className="text-slate-400 truncate min-w-0 flex-1">{q.distanceKm != null ? `cách ~${q.distanceKm}km` : "gần đây"} · {timeAgoVi(q.time)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">Không có động đất đáng kể gần đây.</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Market mini-cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {/* Bitcoin */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[92px]">
            <ShimmerLine via="via-amber-500/50" />
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
              <TrendRow values={marketSeries.btc} />
            </div>
          </div>

          {/* Ethereum */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[92px]">
            <ShimmerLine via="via-indigo-500/50" />
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
              <TrendRow values={marketSeries.eth} />
            </div>
          </div>

          {/* Gold */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-yellow-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-yellow-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[92px]">
            <ShimmerLine via="via-yellow-500/50" />
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
              <TrendRow values={marketSeries.gold} />
            </div>
          </div>

          {/* USD/VND */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-4 shadow-md hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[92px]">
            <ShimmerLine via="via-emerald-500/50" />
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
              <TrendRow values={marketSeries.fx} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Stats Row — glass cards with an accent glow that answers hover */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-stats">
        {/* Card 1: My Remaining Tasks */}
        <motion.div
          {...fadeUp(0.18)}
          whileHover={reduceMotion ? undefined : { y: -4 }}
          onClick={() => onNavigate("tasks")}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-sky-500/40 p-4 rounded-2xl shadow-md hover:shadow-xl hover:shadow-sky-500/10 transition-[box-shadow,border-color] duration-300 cursor-pointer flex flex-col justify-between"
          id="stat-my-tasks"
        >
          <ShimmerLine via="via-sky-500/50" />
          <div aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-sky-500/10 blur-2xl group-hover:bg-sky-500/20 transition-colors duration-500" />
          <div className="relative flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Task của tôi</span>
            <div className="bg-gradient-to-br from-sky-500/25 to-sky-500/5 ring-1 ring-sky-500/20 p-2 rounded-xl text-sky-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="relative mt-4">
            <span className="text-2xl md:text-3xl font-bold text-slate-100 tabular-nums">{myRemainingTasks.length}</span>
            <p className="text-slate-500 text-xs mt-1">Đang cần giải quyết</p>
          </div>
        </motion.div>

        {/* Card 2: Urgent Tasks */}
        <motion.div
          {...fadeUp(0.23)}
          whileHover={reduceMotion ? undefined : { y: -4 }}
          onClick={() => onNavigate("tasks")}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-rose-500/40 p-4 rounded-2xl shadow-md hover:shadow-xl hover:shadow-rose-500/10 transition-[box-shadow,border-color] duration-300 cursor-pointer flex flex-col justify-between"
          id="stat-urgent-tasks"
        >
          <ShimmerLine via="via-rose-500/50" />
          <div aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-rose-500/10 blur-2xl group-hover:bg-rose-500/20 transition-colors duration-500" />
          <div className="relative flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Nhiệm vụ khẩn cấp</span>
            <div className="bg-gradient-to-br from-rose-500/25 to-rose-500/5 ring-1 ring-rose-500/20 p-2 rounded-xl text-rose-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <AlertCircle className={`w-5 h-5 ${urgentTasksCount > 0 && !reduceMotion ? "animate-bounce" : ""}`} />
            </div>
          </div>
          <div className="relative mt-4">
            <span className="text-2xl md:text-3xl font-bold text-rose-400 tabular-nums">{urgentTasksCount}</span>
            <p className="text-slate-500 text-xs mt-1">Mức ưu tiên cao</p>
          </div>
        </motion.div>

        {/* Card 3: Cash balance this month */}
        <motion.div
          {...fadeUp(0.28)}
          whileHover={reduceMotion ? undefined : { y: -4 }}
          onClick={() => onNavigate("finance")}
          className={`group relative overflow-hidden bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md hover:shadow-xl transition-[box-shadow,border-color] duration-300 cursor-pointer flex flex-col justify-between ${balancePositive ? "hover:border-emerald-500/40 hover:shadow-emerald-500/10" : "hover:border-rose-500/40 hover:shadow-rose-500/10"}`}
          id="stat-monthly-balance"
        >
          <ShimmerLine via={balancePositive ? "via-emerald-500/50" : "via-rose-500/50"} />
          <div aria-hidden className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl transition-colors duration-500 ${balancePositive ? "bg-emerald-500/10 group-hover:bg-emerald-500/20" : "bg-rose-500/10 group-hover:bg-rose-500/20"}`} />
          <div className="relative flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Số dư tháng này</span>
            <div className={`p-2 rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ${balancePositive ? "bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 ring-1 ring-emerald-500/20 text-emerald-400" : "bg-gradient-to-br from-rose-500/25 to-rose-500/5 ring-1 ring-rose-500/20 text-rose-400"}`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="relative mt-4">
            <span className={`text-xl md:text-2xl font-bold tabular-nums ${balancePositive ? "text-emerald-400" : "text-rose-400"}`}>
              {financialSummary.balance.toLocaleString()}đ
            </span>
            <p className="text-slate-500 text-xs mt-1">Thu nhập trừ chi tiêu</p>
          </div>
        </motion.div>

        {/* Card 4: Upcoming Schedule */}
        <motion.div
          {...fadeUp(0.33)}
          whileHover={reduceMotion ? undefined : { y: -4 }}
          onClick={() => onNavigate("plans")}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-4 rounded-2xl shadow-md hover:shadow-xl hover:shadow-amber-500/10 transition-[box-shadow,border-color] duration-300 cursor-pointer flex flex-col justify-between"
          id="stat-schedules"
        >
          <ShimmerLine via="via-amber-500/50" />
          <div aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-colors duration-500" />
          <div className="relative flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Lịch 20 ngày tới</span>
            <div className="bg-gradient-to-br from-amber-500/25 to-amber-500/5 ring-1 ring-amber-500/20 p-2 rounded-xl text-amber-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="relative mt-4">
            <span className="text-2xl md:text-3xl font-bold text-slate-100 tabular-nums">{upcomingPlans.length}</span>
            <p className="text-slate-500 text-xs mt-1">Sự kiện/Lịch trình</p>
          </div>
        </motion.div>
      </div>

      {/* Main Dashboard Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-grid">

        {/* Left Column - Schedules & Notes (Col 7) */}
        <motion.div {...fadeUp(0.3)} className="lg:col-span-7 space-y-6">

          {/* Upcoming Schedule */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-upcoming-plans">
            <ShimmerLine via="via-amber-500/50" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <IconChip accent="amber"><Calendar className="w-4 h-4" /></IconChip>
                Sự kiện sắp diễn ra
              </h3>
              <button
                onClick={() => onNavigate("plans")}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 group cursor-pointer"
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
                {upcomingPlans.map((plan) => {
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
                      className={`p-3 rounded-xl flex items-center justify-between ${colorMap[plan.color] || "border-l-4 border-slate-600 bg-slate-800/10"} hover:bg-slate-800/30 hover:translate-x-1 transition-all duration-300`}
                    >
                      <div className="space-y-0.5 max-w-[70%]">
                        <span className="text-sm font-semibold text-slate-200 block truncate">{plan.title}</span>
                        <p className="text-xs text-slate-500 truncate">{plan.description || "Không có miêu tả"}</p>
                      </div>
                      <div className="text-right flex flex-col justify-center shrink-0">
                        <span className="text-xs font-semibold text-slate-300 font-mono">{sDate[0]}</span>
                        <span className="text-[10px] font-mono text-amber-400/80">{sDate[1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Birthdays */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-birthdays">
            <ShimmerLine via="via-pink-500/50" />
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <IconChip accent="pink"><Cake className="w-4 h-4" /></IconChip>
              Sinh nhật sắp tới
            </h3>

            {upcomingBirthdays.length === 0 ? (
              <div className="bg-slate-950/40 border border-dashed border-slate-800 p-6 rounded-xl text-center">
                <p className="text-sm text-slate-500">Chưa có sinh nhật nào trong 30 ngày tới. Thêm ngày sinh ở mục <span className="text-indigo-400 font-semibold">Thiết lập → Hồ sơ của tôi</span> để được nhắc nhé!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingBirthdays.map(b => (
                  <div key={b.user.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 hover:translate-x-1 ${b.daysUntil === 0 ? "bg-gradient-to-r from-pink-500/10 to-fuchsia-500/5 border-pink-500/20" : "bg-slate-950/60 border-slate-800/60 hover:bg-slate-800/30"}`}>
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
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-pinned-notes">
            <ShimmerLine via="via-sky-500/50" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <IconChip accent="sky"><FileText className="w-4 h-4" /></IconChip>
                Ghi chú gia đình nổi bật
              </h3>
              <button
                onClick={() => onNavigate("notes")}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 group cursor-pointer"
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
                      className="bg-slate-950 hover:bg-slate-800/40 border border-slate-800/80 hover:border-sky-500/30 p-3.5 rounded-xl cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/5 flex flex-col justify-between min-h-[140px] shadow-sm relative group"
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
        </motion.div>

        {/* Right Column - Finances (Month Breakdown) & Activities Logger (Col 5) */}
        <motion.div {...fadeUp(0.38)} className="lg:col-span-5 space-y-6">

          {/* Recent Money Widget */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-finance-overview">
            <ShimmerLine via="via-emerald-500/50" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <IconChip accent="emerald"><Wallet className="w-4 h-4" /></IconChip>
                Tài chính chi tiêu tháng {new Date().getMonth() + 1}
              </h3>
              <button
                onClick={() => onNavigate("finance")}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 group cursor-pointer"
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
                  <p className="text-sm font-bold text-slate-200 font-mono">{financialSummary.income.toLocaleString()}đ</p>
                </div>
                <div className="text-right space-y-1">
                  <span className="flex items-center gap-1 justify-end text-[11px]"><TrendingDown className="w-3 h-3 text-rose-400" /> Tổng Chi</span>
                  <p className="text-sm font-bold text-slate-200 font-mono">{financialSummary.expense.toLocaleString()}đ</p>
                </div>
              </div>

              {/* Graphical Bar — fills up from 0 once the page enters */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  {financeTotal > 0 ? (
                    <>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${incomePct}%` }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 1, delay: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${expensePct}%` }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 1, delay: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-rose-400 to-rose-500"
                      />
                    </>
                  ) : (
                    <div className="h-full w-full bg-slate-800" />
                  )}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>{financeTotal > 0 ? `${Math.round(incomePct)}% Thu` : "0% Thu"}</span>
                  <span>{financeTotal > 0 ? `${Math.round(expensePct)}% Chi` : "0% Chi"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Logs inside family */}
          <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4" id="widget-activity-logs">
            <ShimmerLine via="via-indigo-500/50" />
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <IconChip accent="indigo"><Activity className="w-4 h-4" /></IconChip>
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
                    <div key={log.id} className="text-[11px] p-2 hover:bg-slate-900/50 rounded transition-all text-slate-300 border-l border-slate-800/80 hover:border-indigo-500/50">
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

        </motion.div>
      </div>
    </div>
  );
}
