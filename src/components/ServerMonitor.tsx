/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Thermometer, MemoryStick, HardDrive, Server, Activity, Clock, AlertTriangle } from "lucide-react";
import { ShimmerLine, Reveal, IconChip, Accent } from "./Lively.js";

// Poll thông số máy chủ mỗi 2s khi tab đang mở & app đang hiển thị.
const POLL_MS = 2000;
// Số điểm giữ lại cho biểu đồ realtime (~3 phút lịch sử với poll 2s).
const HISTORY_MAX = 90;

interface ServerStats {
  at: string;
  hostname: string;
  platform: string;
  uptimeSec: number;
  loadAvg: number[];
  cpu: { percent: number | null; cores: number; model: string };
  tempC: number | null;
  memory: { totalBytes: number; usedBytes: number; availableBytes: number };
  disk: { totalBytes: number; usedBytes: number; freeBytes: number } | null;
}

interface ServerMonitorProps {
  authHeaders: Record<string, string>;
}

const fmtGb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1).replace(".", ",") + " GB";

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

// Biểu đồ đường realtime 0–100% (SVG thuần, không thêm thư viện).
function HistoryChart({ cpu, ram }: { cpu: (number | null)[]; ram: number[] }) {
  const W = 600, H = 140, pad = 6;
  const toPoints = (data: (number | null)[]) => {
    const pts: string[] = [];
    data.forEach((v, i) => {
      if (v === null) return;
      const x = data.length <= 1 ? W / 2 : pad + (i / (HISTORY_MAX - 1)) * (W - 2 * pad);
      const y = H - pad - (Math.min(100, Math.max(0, v)) / 100) * (H - 2 * pad);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return pts.join(" ");
  };
  return (
    <div className="space-y-1.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" preserveAspectRatio="none" aria-hidden>
        {/* Lưới ngang 25/50/75% */}
        {[25, 50, 75].map(p => {
          const y = H - pad - (p / 100) * (H - 2 * pad);
          return <line key={p} x1={pad} x2={W - pad} y1={y} y2={y} stroke="currentColor" className="text-slate-800" strokeWidth="1" strokeDasharray="4 6" />;
        })}
        <polyline points={toPoints(ram)} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
        <polyline points={toPoints(cpu)} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-emerald-400 inline-block" /> CPU %</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-indigo-400 inline-block" /> RAM %</span>
        <span className="ml-auto font-mono">~{Math.round(HISTORY_MAX * POLL_MS / 60000)} phút gần nhất</span>
      </div>
    </div>
  );
}

export function ServerMonitor({ authHeaders }: ServerMonitorProps) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [error, setError] = useState("");
  const [cpuHistory, setCpuHistory] = useState<(number | null)[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
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
        const ramPct = data.memory ? (data.memory.usedBytes / data.memory.totalBytes) * 100 : 0;
        setCpuHistory(prev => [...prev, data.cpu?.percent ?? null].slice(-HISTORY_MAX));
        setRamHistory(prev => [...prev, ramPct].slice(-HISTORY_MAX));
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

        {/* Nhiệt độ CPU */}
        <Reveal delay={0.1} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <ShimmerLine accent={tempAccent} />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Nhiệt độ CPU</span>
            <IconChip accent={tempAccent}><Thermometer className="w-4 h-4" /></IconChip>
          </div>
          <div>
            {stats ? (
              <span className={`text-2xl md:text-3xl font-extrabold tabular-nums ${LEVEL_TEXT[tempAccent]}`}>
                {stats.tempC === null ? "—" : `${stats.tempC.toFixed(1).replace(".", ",")}°C`}
              </span>
            ) : skeleton}
            <p className="text-slate-500 text-[10px] mt-1">
              {stats && stats.tempC === null ? "Máy chủ không cho đọc cảm biến" : "Ngưỡng cảnh báo 60°C · nóng 75°C"}
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

      {/* Biểu đồ realtime CPU/RAM */}
      <Reveal delay={0.22} className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-3">
        <ShimmerLine accent="sky" />
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <IconChip accent="sky"><Activity className="w-4 h-4" /></IconChip> Biểu đồ theo thời gian thực
        </h3>
        {cpuHistory.length < 2 ? (
          <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl py-10 text-center">
            <p className="text-sm text-slate-500">Đang thu thập dữ liệu... biểu đồ hiện sau vài giây.</p>
          </div>
        ) : (
          <HistoryChart cpu={cpuHistory} ram={ramHistory} />
        )}
      </Reveal>
    </div>
  );
}
