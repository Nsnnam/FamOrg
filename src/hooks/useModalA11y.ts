/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, RefObject } from "react";

/**
 * Shared accessibility behaviour for overlay/modal dialogs:
 *   - press Escape to close
 *   - lock background scroll while any modal is open
 *   - (when a containerRef is provided) trap keyboard focus inside the dialog:
 *       · move focus into the dialog on open
 *       · keep Tab / Shift+Tab cycling within it
 *       · restore focus to the trigger element on close
 *
 * Body scroll-lock uses a module-level counter so stacked modals (e.g. a
 * confirm dialog opened on top of an edit modal) don't unlock the page until
 * the last one closes.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useModalA11y(isOpen, onClose, ref);   // attach ref to the dialog element
 * The ref is optional — omit it for plain Escape + scroll-lock behaviour.
 */

let lockCount = 0;
let savedOverflow = "";

function lockScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
  }
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  );
}

export function useModalA11y(
  active: boolean,
  onClose: () => void,
  containerRef?: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!active) return;

    // Remember what was focused so we can restore it when the modal closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const root = containerRef?.current;
      if (!root) return;

      const focusables = getFocusable(root);
      if (focusables.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      // Focus escaped the dialog (or is on the backdrop) → pull it back in.
      if (!activeEl || !root.contains(activeEl)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    lockScroll();

    // Move focus into the dialog after it has mounted — but don't steal focus
    // from an element that already auto-focused itself (e.g. autoFocus inputs).
    const focusTimer = window.setTimeout(() => {
      const root = containerRef?.current;
      if (!root || root.contains(document.activeElement)) return;
      const focusables = getFocusable(root);
      (focusables[0] || root).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, onClose, containerRef]);
}
