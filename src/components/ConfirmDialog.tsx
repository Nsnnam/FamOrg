/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { motion } from "motion/react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

/**
 * In-app confirmation dialog hook. Replaces the native browser confirm()
 * popup with a styled modal that matches the app theme.
 *
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   const ok = await confirm({ title, message, tone: "danger" });
 *   if (ok) { ...do the thing... }
 *   // render {ConfirmDialog} somewhere in the component's JSX.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const isDanger = options?.tone !== "default";

  const ConfirmDialog = options ? (
    <div
      onClick={() => close(false)}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[60] p-4"
      id="confirm-dialog"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${isDanger ? "bg-rose-500/10 text-rose-400" : "bg-sky-500/10 text-sky-400"}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-md font-bold text-slate-100 leading-snug">{options.title}</h3>
          </div>
          <button
            onClick={() => close(false)}
            className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-sans whitespace-pre-line">
          {options.message}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl transition-all cursor-pointer font-bold text-xs"
          >
            {options.cancelLabel || "Hủy bỏ"}
          </button>
          <button
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer text-xs text-slate-950 ${isDanger ? "bg-rose-500 hover:bg-rose-400" : "bg-sky-500 hover:bg-sky-400"}`}
          >
            {options.confirmLabel || "Xác nhận"}
          </button>
        </div>
      </motion.div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
