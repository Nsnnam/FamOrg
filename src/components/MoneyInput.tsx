/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from "react";
import { readVnMoney } from "../utils/vietnameseNumber.js";

// Đánh giá biểu thức toán học cơ bản (50000+20000 hoặc 15*1000) an toàn không dùng eval()
export function evalMoneyExpression(raw: string): number {
  const cleaned = raw.replace(/[^\d+\-*]/g, "");
  if (!cleaned) return 0;
  try {
    const tokens = cleaned.match(/\d+|[+\-*]/g) || [];
    if (tokens.length === 0) return 0;
    let total = Number(tokens[0]) || 0;
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const next = Number(tokens[i + 1]) || 0;
      if (op === "+") total += next;
      else if (op === "-") total = Math.max(0, total - next);
      else if (op === "*") total *= next;
    }
    return Math.round(total);
  } catch {
    return Number(cleaned.replace(/\D/g, "")) || 0;
  }
}

// Nhóm hàng nghìn cho biểu thức: "50000+20000" → "50.000+20.000"
export function formatMoneyExpr(input: string): string {
  const cleaned = input.replace(/[^\d+\-*]/g, "");
  return cleaned.replace(/\d+/g, (m) => Number(m).toLocaleString("vi-VN"));
}

export interface MoneyInputProps {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  currency?: string;
  operators?: boolean;
  quickZeros?: boolean;
  showInWords?: boolean;
  hideSuggestions?: boolean;
  ariaLabel?: string;
}

/**
 * Ô nhập tiền thông minh chuẩn toàn hệ thống:
 * 1. Định dạng nhóm hàng nghìn tự động theo chuẩn vi-VN (15.000.000).
 * 2. Nút nhanh "+00" và "+000" để thêm 2 hoặc 3 số 0 chỉ với 1 chạm.
 * 3. Hàng chip gợi ý các mệnh giá và thêm số 0 khi đang nhập.
 * 4. Đọc số tiền bằng chữ tiếng Việt (tránh nhầm lẫn hàng triệu / hàng chục triệu).
 * 5. Tùy chọn nút toán tử + / × để cộng dồn hoặc nhân số lượng.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = "Nhập số tiền...",
  className = "",
  id,
  autoFocus,
  disabled,
  currency = "VNĐ",
  operators = false,
  quickZeros = true,
  showInWords = true,
  hideSuggestions = false,
  ariaLabel
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ raw khi value bên ngoài thay đổi mà không focus
  useEffect(() => {
    if (!focused) {
      setRaw(value > 0 ? value.toLocaleString("vi-VN") : "");
    }
  }, [value, focused]);

  const hasOperator = /\d\s*[+\-*]\s*\d/.test(raw);
  const preview = evalMoneyExpression(raw);
  const display = focused ? raw : (value > 0 ? value.toLocaleString("vi-VN") : "");

  // Gợi ý thông minh: khi có số thì gợi ý thêm 2, 3, 4, 5, 6 số 0; khi trống thì gợi ý mệnh giá
  const suggestions = useMemo(() => {
    const digits = (focused ? raw : String(value || "")).replace(/\D/g, "");
    if (!digits) {
      return ["10000", "50000", "100000", "500000", "1000000", "10000000"];
    }
    const num = Number(digits);
    if (num <= 0) return [];

    const out: string[] = [];
    // Thêm 2 số 0 (+00), 3 số 0 (+000), 4 số 0, 5 số 0, 6 số 0
    for (const z of [2, 3, 4, 5, 6]) {
      const candidate = digits + "0".repeat(z);
      if (Number(candidate) <= 100_000_000_000) {
        out.push(candidate);
      }
    }
    return [...new Set(out)].slice(0, 5);
  }, [raw, value, focused]);

  const commit = () => {
    const calculated = evalMoneyExpression(raw);
    onChange(calculated);
    setRaw(calculated > 0 ? calculated.toLocaleString("vi-VN") : "");
    setFocused(false);
  };

  const setFromInput = (text: string) => {
    const formatted = formatMoneyExpr(text);
    setRaw(formatted);
    onChange(evalMoneyExpression(formatted));
  };

  const appendZeros = (count: 2 | 3) => {
    const currentVal = evalMoneyExpression(raw || String(value || 0));
    let newVal: number;
    if (currentVal <= 0) {
      newVal = count === 2 ? 100 : 1000;
    } else {
      newVal = currentVal * (count === 2 ? 100 : 1000);
    }
    const formatted = newVal.toLocaleString("vi-VN");
    setRaw(formatted);
    onChange(newVal);
    setFocused(true);
    inputRef.current?.focus();
  };

  const pickSuggestion = (s: string) => {
    const formatted = formatMoneyExpr(s);
    const calculated = evalMoneyExpression(formatted);
    setRaw(formatted);
    onChange(calculated);
    setFocused(true);
    inputRef.current?.focus();
  };

  const appendOp = (op: string) => {
    const base = raw.trim() === "" && value > 0 ? value.toLocaleString("vi-VN") : raw;
    const trimmed = base.replace(/[+\-*]+$/, "");
    if (trimmed === "") return;
    const next = trimmed + op;
    setRaw(next);
    setFocused(true);
    onChange(evalMoneyExpression(next));
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full space-y-1">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          disabled={disabled}
          value={display}
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
          onFocus={() => {
            setRaw(value > 0 ? value.toLocaleString("vi-VN") : "");
            setFocused(true);
          }}
          onChange={(e) => setFromInput(e.target.value)}
          onBlur={() => {
            setTimeout(commit, 180);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              inputRef.current?.blur();
            }
          }}
          className={`w-full bg-slate-950 border border-slate-850 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none focus:border-amber-500 transition-colors ${quickZeros ? "pr-28" : "pr-12"} ${className}`}
        />

        {/* Nút hành động nhanh bên trong ô nhập: +00, +000 hoặc đơn vị tiền */}
        <div className="absolute right-1.5 flex items-center gap-1 z-10">
          {quickZeros && !disabled && (
            <>
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => appendZeros(2)}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-700/60 dark:border-slate-700 cursor-pointer transition-colors shadow-2xs"
                title="Thêm 2 số 0"
              >
                +00
              </button>
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => appendZeros(3)}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 cursor-pointer transition-colors shadow-2xs"
                title="Thêm 3 số 0"
              >
                +000
              </button>
            </>
          )}
          {currency && (
            <span className="text-[10px] text-slate-500 font-mono pl-0.5 pointer-events-none pr-1">
              {currency}
            </span>
          )}
          {operators && !disabled && (
            <div className="flex gap-0.5 pl-1 border-l border-slate-800">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Cộng thêm"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => appendOp("+")}
                className="size-6 grid place-items-center rounded bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-bold text-xs leading-none transition-colors"
              >
                +
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Nhân số lượng"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => appendOp("*")}
                className="size-6 grid place-items-center rounded bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-700 dark:hover:text-sky-400 font-bold text-xs leading-none transition-colors"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dòng gợi ý các mệnh giá / thêm số 0 khi focus */}
      {focused && !hideSuggestions && suggestions.length > 0 && (
        <div className="flex items-center flex-wrap gap-1 pt-0.5 animate-in fade-in duration-150">
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mr-0.5 shrink-0">
            Gợi ý:
          </span>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pickSuggestion(s)}
              className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-850 dark:border-slate-800 hover:border-amber-400 text-slate-700 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer"
            >
              {Number(s).toLocaleString("vi-VN")}
            </button>
          ))}
        </div>
      )}

      {/* Hiển thị kết quả biểu thức nếu có toán tử */}
      {focused && hasOperator && (
        <p className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
          = {preview.toLocaleString("vi-VN")} {currency}
        </p>
      )}

      {/* Đọc số tiền bằng chữ tiếng Việt */}
      {showInWords && (focused || value >= 10000) && value >= 1000 && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic truncate">
          ≈ {readVnMoney(value)}
        </p>
      )}
    </div>
  );
}
