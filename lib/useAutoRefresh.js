"use client";

import { useEffect, useRef } from "react";

/**
 * Re-run a loader on a fixed interval. Rules that keep it safe around humans:
 *  - ticks only while the tab is visible (no wasted calls, no surprise reloads
 *    on a phone left in a pocket);
 *  - skips a tick while the user has any input focused, so typing in a filter
 *    or form field is never clobbered mid-word;
 *  - always refreshes once immediately on regaining visibility.
 * fn must be stable or memoized by the caller (we keep the latest via ref).
 */
export default function useAutoRefresh(fn, intervalMs = 15000) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;
    let timer = null;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const el = document.activeElement;
      const typing =
        el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ||
          el.isContentEditable);
      if (typing) return; // don't clobber someone filling a form
      try { ref.current(); } catch {}
    };

    const start = () => {
      if (timer == null) timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer != null) { clearInterval(timer); timer = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick(); // catch up immediately
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
