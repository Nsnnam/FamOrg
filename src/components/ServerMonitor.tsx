/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Thermometer, MemoryStick, HardDrive, Server, Activity, Clock, AlertTriangle } from "lucide-react";
import { ShimmerLine, Reveal, IconChip, Accent } from "./Lively.js";

// Poll thông số máy chủ mỗi 2s khi tab đang mở & app đang hiển thị.
const POLL_MS = 2000;
// Số mẫu giữ lại cho biểu đồ realtime (~3 phút lịch sử với poll 2s).
const HISTORY_MAX = 90;

interface ServerStats {
  at: string;
  hostname: string;
  platform: string;
  uptimeSec: number;
  loadAvg: number[];
  cpu: { percent: number | null; cores: number; model: string };
  tempC: number | null;
  ssdTempC: number | null;
  memory: { totalBytes: number; usedBytes: number; availableBytes: number };
  disk: { totalBytes: number; usedBytes: number; freeBytes: number } | null;
}

// Một mẫu đo cho biểu đồ (t = epoch ms lúc nhận).
interface Sample {
  t: number;
  cpu: number | null;
  ram: number;
  temp: number | null;
  ssd: number | null;
}

interface ServerMonitorProps {
  authHeaders: Record<string, string>;
}

const fmtGb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1).replace(".", ",") + " GB";
const fmtTemp = (c: number) => c.toFixed(1).replace(".", ",") + "°C";
const fmtClock = (t: number) =>
  new Date(t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtUptime = (sec: number) => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d} ngày ${h} giờ` : h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
};

// Ngưỡng màu theo mức độ "nóng" của chỉ số (% hoặc °C).
const levelAccent = (value: number | null, warn: number, danger: number): Accent =>
  value === null ? "sky" : value >= danger ? "rose" : value >= warn ? "amber" : "emerald";

const LEVEL_TEXT: Record<string, string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  sky: "text-sky-400"
};
const LEVEL_BAR: Record<string, string> = {
  emerald: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  amber: "bg-gradient-to-r from-amber-500 to-amber-400",
  rose: "bg-gradient-to-r from-rose-500 to-rose-400",
  sky: "bg-gradient-to-r from-sky-500 to-sky-400"
};

// Thanh % dùng chung cho các thẻ chỉ số.
function LevelBar({ pct, accent }: { pct: number; accent: Accent }) {
  return (
    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${LEVEL_BAR[accent]} transition-[width] duration-700 ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

interface ChartSeries {
  label: string;
  color: string;
  values: (number | null)[];
}

/**
 * Biểu đồ đường có trục rõ ràng: trục X = thời gian (HH:mm:ss),
 * trục Y = giá trị có nhãn (% hoặc °). SVG thuần, tự co theo bề rộng thẻ.
 */
function AxisChart({ series, times, yMin, yMax, yTicks, unit }: {
  series: ChartSeries[];
  times: number[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  unit: string;
}) {
  const W = 420, H = 170;
  const M = { top: 10, right: 10, bottom: 24, left: 38 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const n = times.length;
  const x = (i: number) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => M.top + ih - ((Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin || 1)) * ih;
  const linePoints = (values: (number | null)[]) =>
    values
      .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  // 4 mốc thời gian trải đều trên trục X (bỏ trùng khi còn ít dữ liệu).
  const xTickIdx = n >= 2
    ? Array.from(new Set([0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1]))
    : [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {/* Lưới ngang + nhãn trục Y */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} className="stroke-slate-800" strokeWidth="1" strokeDasharray="3 5" />
          <text x={M.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" className="fill-slate-500 font-mono">
            {v}{unit}
          </text>
        </g>
      ))}
      {/* Trục */}
      <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + ih} className="stroke-slate-800" strokeWidth="1.5" />
      <line x1={M.left} x2={W - M.right} y1={M.top + ih} y2={M.top + ih} className="stroke-slate-800" strokeWidth="1.5" />
      {/* Nhãn thời gian trục X */}
      {xTickIdx.map(i => (
        <text
          key={i}
          x={x(i)}
          y={H - 7}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          fontSize="10"
          className="fill-slate-500 font-mono"
        >
          {fmtClock(times[i])}
        </text>
      ))}
      {/* Đường dữ liệu */}
      {series.map(s => (
        <polyline
          key={s.label}
          points={linePoints(s.values)}
          fill="none"
          stroke={s.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// Khung thẻ chứa một biểu đồ: tiêu đề + giá trị hiện tại + chú giải màu.
function ChartCard({ accent, icon, title, legend, children, delay }: {
  accent: Accent;
  icon: React.ReactNode;
  title: string;
  legend: { label: string; color: string; value: string }[];
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 space-y-2">
      <ShimmerLine accent={accent} />
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <IconChip accent={accent}>{icon}</IconChip> {title}
        </h4>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {legend.map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: l.color }} />
              {l.label} <b className="text-slate-200 font-mono tabular-nums">{l.value}</b>
            </span>
          ))}
        </div>
      </div>
      {children}
    </Reveal>
  );
}

const CollectingHint = () => (
  <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl py-9 text-center">
    <p className="text-xs text-slate-500">Đang thu thập dữ liệu... biểu đồ hiện sau vài giây.</p>
  </div>
);

export function ServerMonitor({ authHeaders }: ServerMonitorProps) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Sample[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchStats = async () => {
      // Không poll khi app chạy nền (PWA iPhone) — đỡ tốn pin & băng thông.
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/server/stats", { headers: authHeaders });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không đọc được thông số máy chủ.");
        if (!alive) return;
        setStats(data);
        setError("");
        setHistory(prev => [
          ...prev,
          {
            t: Date.now(),
            cpu: data.cpu?.percent ?? null,
            ram: data.memory ? (data.memory.usedBytes / data.memory.totalBytes) * 100 : 0,
            temp: data.tempC ?? null,
            ssd: data.ssdTempC ?? null
          }
        ].slice(-HISTORY_MAX));
      } catch (err: any) {
        if (alive) setError(err.message || "Mất kết nối tới máy chủ.");
      }
    };

    fetchStats();
    timerRef.current = setInterval(fetchStats, POLL_MS);
    document.addEventListener("visibilitychange", fetchStats);
    return () => {
      alive = false;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", fetchStats);
    };
  }, []); // authHeaders ổn định trong một phiên đăng nhập

  const cpuPct = stats?.cpu.percent ?? null;
  const ramPct = stats ? (stats.memory.usedBytes / stats.memory.totalBytes) * 100 : null;
  const diskPct = stats?.disk ? (stats.disk.usedBytes / stats.disk.totalBytes) * 100 : null;

  const cpuAccent = levelAccent(cpuPct, 60, 85);
  const tempAccent = levelAccent(stats?.tempC ?? null, 60, 75);
  const ramAccent = levelAccent(ramPct, 70, 90);
  const diskAccent = levelAccent(diskPct, 75, 90);

  const times = useMemo(() => history.map(s => s.t), [history]);
  const hasChart = history.length >= 2;

  // Trục Y biểu đồ nhiệt: tự co theo dữ liệu, làm tròn bậc 10 cho nhãn đẹp.
  const tempDomain = useMemo(() => {
    const vals = history.flatMap(s => [s.temp, s.ssd]).filter((v): v is number => v !== null);
    if (vals.length === 0) return { min: 20, max: 80 };
    const min = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10);
    const max = Math.min(110, Math.ceil((Math.max(...vals) + 3) / 10) * 10);
    return max - min < 20 ? { min: Math.max(0, max - 20), max } : { min, max };
  }, [history]);
  const tempTicks = useMemo(
    () => [0, 1, 2, 3, 4].map(i => Math.round(tempDomain.min + (i * (tempDomain.max - tempDomain.min)) / 4)),
    [tempDomain]
  );

  const pctTicks = [0, 25, 50, 75, 100];
  const lastSample = history[history.length - 1];

  const skeleton = <span className="inline-block bg-slate-700/40 rounded-md animate-pulse h-8 w-24 align-middle" />;

  const infoChips = useMemo(() => {
    if (!stats) return null;
    return (
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-mono"><Server className="w-3.5 h-3.5 text-sky-400" /> {stats.hostname} · {stats.platform}</span>
        <span className="flex items-center gap-1.5 font-mono"><Clock className="w-3.5 h-3.5 text-amber-400" /> Uptime {fmtUptime(stats.uptimeSec)}</span>
        <span className="flex items-center gap-1.5 font-mono"><Activity className="w-3.5 h-3.5 text-emerald-400" /> Load {stats.loadAvg.map(n => n.toFixed(2)).join(" / ")}</span>
      </div>
    );
  }, [stats]);

  return (
    <div className="space-y-6" id="server-monitor-module">
      {/* Header: tên máy, uptime, load + trạng thái LIVE */}
      <Reveal className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-3">
        <ShimmerLine accent="emerald" />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <IconChip accent="emerald"><Server className="w-4 h-4" /></IconChip> Quản lý Server
          </h3>
          {error ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-3 h-3" /> Mất kết nối
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> LIVE · {POLL_MS / 1000}s
            </span>
          )}
        </div>
        {infoChips}
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
      </Reveal>

      {/* 4 thẻ chỉ số chính */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* CPU % */}
        <Reveal delay={0.06} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <ShimmerLine accent={cpuAccent} />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">CPU</span>
            <IconChip accent={cpuAccent}><Cpu className="w-4 h-4" /></IconChip>
          </div>
          <div>
            {stats ? (
              <span className={`text-2xl md:text-3xl font-extrabold tabular-nums ${LEVEL_TEXT[cpuAccent]}`}>
                {cpuPct === null ? "—" : `${cpuPct.toFixed(0)}%`}
              </span>
            ) : skeleton}
            <p className="text-slate-500 text-[10px] mt-1 truncate">{stats ? `${stats.cpu.cores} nhân${stats.cpu.model ? ` · ${stats.cpu.model}` : ""}` : "Đang đọc..."}</p>
          </div>
          <LevelBar pct={cpuPct ?? 0} accent={cpuAccent} />
        </Reveal>

        {/* Nhiệt độ CPU + SSD */}
        <Reveal delay={0.1} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <ShimmerLine accent={tempAccent} />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Nhiệt độ CPU</span>
            <IconChip accent={tempAccent}><Thermometer className="w-4 h-4" /></IconChip>
          </div>
          <div>
            {stats ? (
              <span className={`text-2xl md:text-3xl font-extrabold tabular-nums ${LEVEL_TEXT[tempAccent]}`}>
                {stats.tempC === null ? "—" : fmtTemp(stats.tempC)}
              </span>
            ) : skeleton}
            <p className="text-slate-500 text-[10px] mt-1 font-mono">
              {stats
                ? stats.ssdTempC !== null
                  ? `SSD NVMe ${fmtTemp(stats.ssdTempC)}`
                  : stats.tempC === null
                    ? "Máy chủ không cho đọc cảm biến"
                    : "SSD không có cảm biến nhiệt"
                : "Đang đọc..."}
            </p>
          </div>
          <LevelBar pct={stats?.tempC ? (stats.tempC / 90) * 100 : 0} accent={tempAccent} />
        </Reveal>

        {/* RAM */}
        <Reveal delay={0.14} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <ShimmerLine accent={ramAccent} />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">RAM</span>
            <IconChip accent={ramAccent}><MemoryStick className="w-4 h-4" /></IconChip>
          </div>
          <div>
            {stats ? (
              <span className={`text-2xl md:text-3xl font-extrabold tabular-nums ${LEVEL_TEXT[ramAccent]}`}>
                {ramPct!.toFixed(0)}%
              </span>
            ) : skeleton}
            <p className="text-slate-500 text-[10px] mt-1 font-mono">
              {stats ? `${fmtGb(stats.memory.usedBytes)} / ${fmtGb(stats.memory.totalBytes)}` : "Đang đọc..."}
            </p>
          </div>
          <LevelBar pct={ramPct ?? 0} accent={ramAccent} />
        </Reveal>

        {/* Ổ đĩa */}
        <Reveal delay={0.18} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <ShimmerLine accent={diskAccent} />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Bộ nhớ (ổ đĩa)</span>
            <IconChip accent={diskAccent}><HardDrive className="w-4 h-4" /></IconChip>
          </div>
          <div>
            {stats ? (
              <span className={`text-2xl md:text-3xl font-extrabold tabular-nums ${LEVEL_TEXT[diskAccent]}`}>
                {diskPct === null ? "—" : `${diskPct.toFixed(0)}%`}
              </span>
            ) : skeleton}
            <p className="text-slate-500 text-[10px] mt-1 font-mono">
              {stats?.disk ? `${fmtGb(stats.disk.usedBytes)} / ${fmtGb(stats.disk.totalBytes)}` : stats ? "Không đọc được phân vùng" : "Đang đọc..."}
            </p>
          </div>
          <LevelBar pct={diskPct ?? 0} accent={diskAccent} />
        </Reveal>
      </div>

      {/* 3 biểu đồ realtime riêng: CPU % · RAM % · Nhiệt độ °C */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          accent="emerald"
          icon={<Cpu className="w-3.5 h-3.5" />}
          title="CPU (%)"
          legend={[{ label: "CPU", color: "#34d399", value: lastSample?.cpu != null ? `${lastSample.cpu.toFixed(0)}%` : "—" }]}
          delay={0.22}
        >
          {hasChart ? (
            <AxisChart
              series={[{ label: "CPU", color: "#34d399", values: history.map(s => s.cpu) }]}
              times={times}
              yMin={0} yMax={100} yTicks={pctTicks} unit="%"
            />
          ) : <CollectingHint />}
        </ChartCard>

        <ChartCard
          accent="indigo"
          icon={<MemoryStick className="w-3.5 h-3.5" />}
          title="RAM (%)"
          legend={[{ label: "RAM", color: "#818cf8", value: lastSample ? `${lastSample.ram.toFixed(0)}%` : "—" }]}
          delay={0.26}
        >
          {hasChart ? (
            <AxisChart
              series={[{ label: "RAM", color: "#818cf8", values: history.map(s => s.ram) }]}
              times={times}
              yMin={0} yMax={100} yTicks={pctTicks} unit="%"
            />
          ) : <CollectingHint />}
        </ChartCard>

        <ChartCard
          accent="amber"
          icon={<Thermometer className="w-3.5 h-3.5" />}
          title="Nhiệt độ (°C)"
          legend={[
            { label: "CPU", color: "#fbbf24", value: lastSample?.temp != null ? fmtTemp(lastSample.temp) : "—" },
            { label: "SSD", color: "#22d3ee", value: lastSample?.ssd != null ? fmtTemp(lastSample.ssd) : "—" }
          ]}
          delay={0.3}
        >
          {hasChart ? (
            <AxisChart
              series={[
                { label: "CPU", color: "#fbbf24", values: history.map(s => s.temp) },
                { label: "SSD", color: "#22d3ee", values: history.map(s => s.ssd) }
              ]}
              times={times}
              yMin={tempDomain.min} yMax={tempDomain.max} yTicks={tempTicks} unit="°"
            />
          ) : <CollectingHint />}
        </ChartCard>
      </div>
    </div>
  );
}
