"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-Up Hook: animiert eine Zahl von 0 zum Ziel-Wert.
 * Easing: ease-out-cubic — schnell am Anfang, langsamer am Ende = "wertig".
 *
 * Beim Re-Mount triggert die Animation neu. Beim Wert-Update (z.B.
 * neuer Tab) animiert von vorherigem zum neuen Wert.
 *
 * Verhalten:
 * - Erstes Mount mit target=N → animiert 0 → N
 * - Re-render mit selbem target → keine Animation (kein Re-Run)
 * - target ändert sich (z.B. Tab-Wechsel mit anderen Daten) → animiert
 *   vom letzten gezeigten Wert zum neuen target
 *
 * Performance: requestAnimationFrame Loop, kein setInterval. Cleanup
 * via cancelAnimationFrame bei Unmount.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTargetRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip wenn der Target sich nicht aendert
    if (lastTargetRef.current === target) return;

    // Reduzierte Animation respektieren
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(target);
      lastTargetRef.current = target;
      return;
    }

    fromRef.current = lastTargetRef.current ?? 0;
    lastTargetRef.current = target;
    startRef.current = null;

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      // Bei Integern wir zeigen Integer — Rundung
      setDisplay(Number.isInteger(target) ? Math.round(next) : next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}
