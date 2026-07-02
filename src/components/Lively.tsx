/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";

/*
 * Lively — bộ hiệu ứng "lung linh" dùng chung cho mọi tab.
 * Quy ước nằm trong DESIGN.md (mục "Lively"). Ba khối chính:
 *   <ShimmerLine>  — đường gradient mảnh ở mép trên thẻ.
 *   <Reveal>       — khối trượt vào khi xuất hiện (stagger bằng prop delay).
 *   <IconChip>     — icon tiêu đề section trong chip gradient.
 * Tất cả tôn trọng useReducedMotion (fallback fade đơn giản).
 */

// Accent hợp lệ cho chip/shimmer — map sang class literal để Tailwind build được.
export type Accent =
  | "sky" | "indigo" | "emerald" | "rose" | "amber" | "pink" | "violet" | "yellow" | "cyan";

const SHIMMER: Record<Accent, string> = {
  sky: "via-sky-500/50",
  indigo: "via-indigo-500/50",
  emerald: "via-emerald-500/50",
  rose: "via-rose-500/50",
  amber: "via-amber-500/50",
  pink: "via-pink-500/50",
  violet: "via-violet-500/50",
  yellow: "via-yellow-500/50",
  cyan: "via-cyan-500/50"
};

const CHIP: Record<Accent, string> = {
  sky: "from-sky-500/25 to-sky-500/5 ring-sky-500/20 text-sky-400",
  indigo: "from-indigo-500/25 to-indigo-500/5 ring-indigo-500/20 text-indigo-400",
  emerald: "from-emerald-500/25 to-emerald-500/5 ring-emerald-500/20 text-emerald-400",
  rose: "from-rose-500/25 to-rose-500/5 ring-rose-500/20 text-rose-400",
  amber: "from-amber-500/25 to-amber-500/5 ring-amber-500/20 text-amber-400",
  pink: "from-pink-500/25 to-pink-500/5 ring-pink-500/20 text-pink-400",
  violet: "from-violet-500/25 to-violet-500/5 ring-violet-500/20 text-violet-400",
  yellow: "from-yellow-500/25 to-yellow-500/5 ring-yellow-500/20 text-yellow-400",
  cyan: "from-cyan-500/25 to-cyan-500/5 ring-cyan-500/20 text-cyan-400"
};

// Hover-lift cho thẻ bấm được: nổi nhẹ + viền/bóng chuyển màu accent.
export const LIFT: Record<Accent, string> = {
  sky: "hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-0.5 transition-all duration-300",
  indigo: "hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300",
  emerald: "hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-all duration-300",
  rose: "hover:border-rose-500/40 hover:shadow-xl hover:shadow-rose-500/10 hover:-translate-y-0.5 transition-all duration-300",
  amber: "hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all duration-300",
  pink: "hover:border-pink-500/40 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-0.5 transition-all duration-300",
  violet: "hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-0.5 transition-all duration-300",
  yellow: "hover:border-yellow-500/40 hover:shadow-xl hover:shadow-yellow-500/10 hover:-translate-y-0.5 transition-all duration-300",
  cyan: "hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-0.5 transition-all duration-300"
};

/** Đường gradient mảnh ôm mép trên thẻ — thẻ cha cần `relative overflow-hidden`. */
export function ShimmerLine({ accent = "sky", via }: { accent?: Accent; via?: string }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent ${via || SHIMMER[accent]} to-transparent`}
    />
  );
}

/** Icon tiêu đề section trong chip gradient có ring. Dùng cạnh chữ `text-sm font-bold`. */
export function IconChip({ accent = "sky", children, className = "" }: {
  accent?: Accent;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`p-1.5 rounded-lg bg-gradient-to-br ring-1 ${CHIP[accent]} ${className}`}>
      {children}
    </span>
  );
}

/**
 * Khối trượt vào khi mount (spring), fade đơn giản khi reduced-motion.
 * Stagger bằng prop `delay` (giây); các mục trong danh sách nên dùng
 * `delay={Math.min(i, 8) * 0.05}` để danh sách dài không chờ quá lâu.
 */
export function Reveal({ children, delay = 0, className, as = "div", id, hoverLift = false, onClick }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
  id?: string;
  /** Nổi nhẹ khi hover — dùng whileHover của motion (KHÔNG dùng CSS translate,
   *  vì inline transform của motion sẽ đè class hover). */
  hoverLift?: boolean;
  onClick?: React.MouseEventHandler;
}) {
  const reduceMotion = useReducedMotion();
  const Tag = (motion as any)[as] as typeof motion.div;
  return (
    <Tag
      id={id}
      onClick={onClick}
      className={className}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      whileHover={hoverLift && !reduceMotion ? { y: -3 } : undefined}
      transition={
        reduceMotion
          ? { duration: 0.3, delay }
          : { type: "spring", stiffness: 260, damping: 26, delay }
      }
    >
      {children}
    </Tag>
  );
}

/** Delay stagger an toàn cho danh sách dài: sau mục thứ `cap` thì vào cùng lúc. */
export const staggerDelay = (index: number, step = 0.05, cap = 8) => Math.min(index, cap) * step;
