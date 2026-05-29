"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type ChangeKind = "INSERT" | "UPDATE" | "DELETE";

interface UseTaskRealtimeOpts {
  /** Wird gerufen bei ANY change auf tasks oder task_notes.
   *  Caller entscheidet selber ob refetch noetig ist (z.B. nur fuer eigene Filter). */
  onChange: (kind: ChangeKind, table: "tasks" | "task_notes") => void;
  /** Wenn false: kein Subscriber aktiv (z.B. waehrend Tab unsichtbar) */
  enabled?: boolean;
}

/**
 * Hoert auf alle Supabase-Realtime-Events fuer tasks + task_notes Tabellen.
 * Debounced den onChange-Callback auf 1.5s — bei Burst-Events (z.B. n8n
 * der 5 Mails auf einmal klassifiziert) wird nur 1× refreshed.
 *
 * Cleanup: unsubscribe + clearTimeout beim Unmount.
 */
export function useTaskRealtime({ onChange, enabled = true }: UseTaskRealtimeOpts) {
  const onChangeRef = useRef(onChange);
  // Refs duerfen in React 19+ nicht waehrend Render geschrieben werden,
  // sonst koennen Strict-Mode-Doppel-Renders zu Stale-Closures fuehren.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Debounce-Timer fuer Burst-Events
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Letzte angezeigte Event-Info fuer den debounced call
  const lastEventRef = useRef<{ kind: ChangeKind; table: "tasks" | "task_notes" } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function emit(kind: ChangeKind, table: "tasks" | "task_notes") {
      lastEventRef.current = { kind, table };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const ev = lastEventRef.current;
        if (ev) onChangeRef.current(ev.kind, ev.table);
      }, 400);
    }

    const channel = supabase
      .channel("mail-tasks-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => emit(payload.eventType as ChangeKind, "tasks"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_notes" },
        (payload) => emit(payload.eventType as ChangeKind, "task_notes"),
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}

/**
 * Helper-Hook: ruft den Callback auch beim Tab-Wechsel (visibilitychange)
 * und im Intervall. Klassisches Polling-Fallback wenn Realtime mal hakt.
 */
export function useVisibilityPoll(
  callback: () => void,
  intervalMs = 60_000,
  enabled = true,
) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function fireIfVisible() {
      if (document.visibilityState === "visible") cbRef.current();
    }

    function onVisChange() {
      if (document.visibilityState === "visible") cbRef.current();
    }

    function start() {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(fireIfVisible, intervalMs);
    }

    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("focus", onVisChange);
    start();

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("focus", onVisChange);
    };
  }, [intervalMs, enabled]);
}
