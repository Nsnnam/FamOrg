/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

/**
 * Browser-independent 24-hour time controls.
 *
 * Native <input type="time"> / "datetime-local" render 12h AM/PM whenever the
 * BROWSER's UI language is English — the page `lang` attribute does not reliably
 * override this. To guarantee 24h everywhere we use explicit HH:MM <select>s and
 * keep the native (calendar) date picker only for the date part.
 *
 * String formats (match the rest of the app):
 *   TimeSelect24    value = "HH:mm"
 *   DateTimePicker24 value = "YYYY-MM-DD HH:mm"
 */

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));

const selectCls =
  "bg-slate-950 border border-slate-800 rounded-lg px-2 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs cursor-pointer";

export function TimeSelect24({
  value,
  onChange,
  className = ""
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [hh = "", mm = ""] = (value || "").split(":");
  const emit = (h: string, m: string) => onChange(`${h || "00"}:${m || "00"}`);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select aria-label="Giờ" value={hh} onChange={(e) => emit(e.target.value, mm)} className={selectCls}>
        {!hh && <option value="">Giờ</option>}
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-slate-500 font-bold">:</span>
      <select aria-label="Phút" value={mm} onChange={(e) => emit(hh, e.target.value)} className={selectCls}>
        {!mm && <option value="">Phút</option>}
        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}

export function DateTimePicker24({
  value,
  onChange,
  required = false
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [datePart = "", timePart = ""] = (value || "").trim().split(" ");
  const [hh = "", mm = ""] = timePart.split(":");

  const emit = (d: string, h: string, m: string) => {
    if (!d) { onChange(""); return; } // no date → treat as empty
    onChange(`${d} ${h || "00"}:${m || "00"}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        type="date"
        lang="en-GB"
        required={required}
        value={datePart}
        onChange={(e) => emit(e.target.value, hh, mm)}
        className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
      />
      <TimeSelect24
        value={hh || mm ? `${hh}:${mm}` : ""}
        onChange={(t) => { const [h, m] = t.split(":"); emit(datePart, h, m); }}
      />
    </div>
  );
}
