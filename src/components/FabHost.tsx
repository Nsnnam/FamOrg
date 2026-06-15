/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/**
 * Floating quick-add button shared across tabs.
 *
 * Only ONE button exists in the DOM, rendered at the app root by <FabProvider>
 * — deliberately OUTSIDE the page-transition wrapper. A `position: fixed` element
 * placed inside a transformed ancestor (framer-motion animates `x` on the content)
 * is positioned relative to that ancestor, which caused the old per-tab buttons to
 * jump/slide. Keeping a single host at the root fixes that and lets the button
 * cross-fade smoothly on tab switch (old exits, new enters) instead of remounting.
 */
export interface TabFabSpec {
  /** Unique per tab — drives the exit→enter handoff when switching tabs. */
  id: string;
  /** Accent colour, matched to the tab's primary action. */
  color: "emerald" | "sky" | "rose";
  /** Accessible label + tooltip. */
  title: string;
  /** Icon — mirror the tab's nav icon so the button reads at a glance. */
  icon: LucideIcon;
  /** Quick-add action for the active tab. */
  onClick: () => void;
}

interface FabRegistry {
  /** Claim the button with this owner's spec. */
  set: (owner: string, spec: TabFabSpec) => void;
  /** Release the button — only takes effect if this owner still holds it. */
  clear: (owner: string) => void;
}

const FabContext = createContext<FabRegistry | null>(null);

const COLOR_CLASS: Record<TabFabSpec["color"], string> = {
  emerald: "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/30",
  sky: "bg-sky-500 hover:bg-sky-400 shadow-sky-500/30",
  rose: "bg-rose-500 hover:bg-rose-400 shadow-rose-500/30",
};

/**
 * Registers the active tab's quick-add button. Call it unconditionally (rules of
 * hooks) and pass `null` to hide the button — e.g. when a modal is open, the user
 * lacks permission, or the relevant sub-view isn't active.
 */
export function useTabFab(spec: TabFabSpec | null) {
  const reg = useContext(FabContext);

  // Stable owner key per hook instance, so a stale clear() from one tab can't
  // wipe the button another tab just claimed (e.g. Finance ↔ Assets sub-views,
  // where parent + child effects fire in the same commit).
  const owner = useRef<string>(`fab_${Math.random().toString(36).slice(2)}`).current;

  // Keep the latest onClick in a ref so the host never re-renders just because a
  // fresh closure was created on the consumer's render.
  const onClickRef = useRef<(() => void) | undefined>(spec?.onClick);
  onClickRef.current = spec?.onClick;

  const id = spec?.id ?? null;
  const color = spec?.color ?? null;
  const title = spec?.title ?? null;
  const Icon = spec?.icon ?? null;

  useEffect(() => {
    if (!reg) return;
    if (!id || !color || !title || !Icon) {
      reg.clear(owner);
      return;
    }
    reg.set(owner, { id, color, title, icon: Icon, onClick: () => onClickRef.current?.() });
    return () => reg.clear(owner);
  }, [reg, owner, id, color, title, Icon]);
}

export function FabProvider({ children }: { children: React.ReactNode }) {
  const [fab, setFab] = useState<TabFabSpec | null>(null);
  const ownerRef = useRef<string | null>(null);

  // Stable registry identity so consumers' effects don't re-fire on every render.
  const registry = useRef<FabRegistry>({
    set: (owner, spec) => {
      ownerRef.current = owner;
      setFab(spec);
    },
    clear: (owner) => {
      // Order-independent: ignore a clear from a tab that no longer owns the button.
      if (ownerRef.current === owner) {
        ownerRef.current = null;
        setFab(null);
      }
    },
  });

  return (
    <FabContext.Provider value={registry.current}>
      {children}
      <FabHost fab={fab} />
    </FabContext.Provider>
  );
}

function FabHost({ fab }: { fab: TabFabSpec | null }) {
  const reduce = useReducedMotion();
  const Icon = fab?.icon;

  return (
    <AnimatePresence mode="wait">
      {fab && Icon && (
        <motion.button
          key={fab.id}
          type="button"
          onClick={fab.onClick}
          title={fab.title}
          aria-label={fab.title}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
          transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 520, damping: 32, mass: 0.7 }}
          whileTap={reduce ? undefined : { scale: 0.88 }}
          className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-30 ${COLOR_CLASS[fab.color]} text-slate-950 rounded-full w-12 h-12 shadow-2xl flex items-center justify-center cursor-pointer will-change-transform`}
        >
          <Icon className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
