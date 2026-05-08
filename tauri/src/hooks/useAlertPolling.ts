import { useEffect, useRef } from "react";

import { pollAlertsNow } from "../api";

/**
 * Adaptive alert polling. The Rust side runs a 30-minute safety-net loop;
 * this hook drives faster polling from the frontend whenever the window is
 * focused.
 *
 *   focused + on Alerts tab  →   60 s
 *   focused, other tab       →    5 min
 *   blurred / minimized      →   paused (Rust takes over)
 */
export function useAlertPolling(opts: { active: boolean; tab: string }) {
  const { active, tab } = opts;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let visible = !document.hidden && document.hasFocus();
    let intervalMs = pickInterval(visible, tab);

    function tick() {
      pollAlertsNow().catch(() => { /* offline = silent, by spec */ });
    }

    function reschedule() {
      const next = pickInterval(visible, tab);
      if (next === intervalMs && timer.current) return;
      intervalMs = next;
      if (timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
      if (intervalMs > 0) {
        timer.current = window.setInterval(tick, intervalMs);
      }
    }

    function onVisibility() {
      visible = !document.hidden && document.hasFocus();
      reschedule();
      // Do an immediate poll when we regain visibility — the cursor may
      // have stale alerts queued up.
      if (visible) tick();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("blur", onVisibility);

    // Initial schedule + an immediate tick so the user doesn't wait a full
    // minute the first time they open Alerts.
    reschedule();
    if (visible) tick();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("blur", onVisibility);
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [active, tab]);
}

function pickInterval(visible: boolean, tab: string): number {
  if (!visible) return 0;
  if (tab === "alerts") return 60_000;
  return 5 * 60_000;
}
