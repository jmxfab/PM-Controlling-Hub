"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Props {
  /** Tabellen-Namen die ueberwacht werden. Bei jedem Insert/Update/Delete
   *  wird router.refresh() debounced gerufen — Next.js re-rendert die
   *  Server-Components und der User sieht die neuen Daten. */
  tables: string[];
  /** Debounce-Fenster in ms (Default 2000) — Burst-Schutz. */
  debounceMs?: number;
  /** Polling-Intervall in ms (Default 90000) — Fallback wenn Realtime hakt. */
  pollMs?: number;
}

/**
 * Drop-in Realtime-Wrapper fuer Server-Component-Seiten.
 * Einfach <RealtimeRefresh tables={['hero_customer_documents']} /> in eine
 * Seite einfuegen und sie aktualisiert sich bei Datenaenderungen automatisch.
 *
 * NICHT super-performant fuer hochfrequente Tabellen (jeder refresh = full
 * Server-Render). Fuer /cash + /projekte vollkommen OK, da deren Backend
 * Daten via Hero-Sync nur alle paar Minuten reinkommen.
 */
export function RealtimeRefresh({
  tables,
  debounceMs = 2000,
  pollMs = 90_000,
}: Props) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function refresh() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.refresh();
      }, debounceMs);
    }

    // 1) Realtime-Subscriber pro Tabelle
    const channel = supabase.channel(
      `rt-refresh-${tables.join("-").slice(0, 50)}`,
    );
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => refresh(),
      );
    }
    channel.subscribe();

    // 2) Polling-Fallback + Visibility-Listener
    let intervalId: ReturnType<typeof setInterval> | null = null;
    function onFocus() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    if (pollMs > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, pollMs);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [router, tables, debounceMs, pollMs]);

  return null;
}
