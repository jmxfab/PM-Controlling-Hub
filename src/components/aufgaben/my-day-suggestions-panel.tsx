"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Star } from "lucide-react";

export type Suggestion = {
  id: string;
  title: string;
  description: string | null;
  mail_category: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  is_important: boolean;
  /** Menschenlesbarer Grund warum die Task vorgeschlagen wird, vom Server. */
  reason: string;
};

/** Tailwind-Token-Klassen fuer den Grund-Badge — gibt visuell Hinweis WIE
 *  dringend der Vorschlag ist (red = ueberfaellig, amber = heute, ...). */
function reasonStyle(reason: string): { className: string } {
  const r = reason.toLowerCase();
  if (r.startsWith("überfällig")) {
    return {
      className:
        "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40",
    };
  }
  if (r === "fällig heute" || r === "dringend") {
    return {
      className:
        "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-950/40",
    };
  }
  if (r === "fällig morgen" || r === "hohe priorität" || r === "kritische mail") {
    return {
      className:
        "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40",
    };
  }
  if (r === "wichtig markiert") {
    return {
      className:
        "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40",
    };
  }
  if (r.startsWith("fällig in") || r === "diese woche fällig") {
    return {
      className:
        "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/40",
    };
  }
  return {
    className: "text-muted-foreground bg-muted/60",
  };
}

/**
 * MS-To-Do-Style "Vorschläge" Panel — laedt offene Tasks die NOCH NICHT in
 * Mein Tag sind und bietet Quick-Add via +-Button. Nur sichtbar im Mein-Tag-Tab.
 */
export function MyDaySuggestionsPanel({
  refreshKey,
  onAdd,
  busyTaskId,
}: {
  /** String-Key der sich bei Mutations aendert — triggert Re-Fetch. */
  refreshKey: string;
  onAdd: (suggestion: Suggestion) => Promise<void>;
  busyTaskId: string | null;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Auf Mobile defaultmaessig kollabiert — sonst sitzt das Panel unter der
  // Liste und nimmt viel Platz. User kann es ausklappen wenn er will.
  const [mobileExpanded, setMobileExpanded] = useState(false);
  /** Aufklapp-State pro Vorschlag — beim Klick auf Titel zeigt sich
   *  description + due_date. Pro Karte/Klick einer auf, andere bleiben zu. */
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    // setState im Effect: Sync mit Fetch-Lifecycle, bewusst gewollt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    window
      .fetch("/api/mail-tasks/my-day-suggestions")
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => {
        if (cancelled) return;
        const list: Suggestion[] = Array.isArray(data?.suggestions)
          ? data.suggestions
          : [];
        setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const visible = items.filter((s) => !dismissed.has(s.id));

  if (loading && visible.length === 0) {
    return (
      <aside className="rounded-2xl border bg-card/60 p-4 space-y-2 sticky top-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vorschläge
        </div>
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      </aside>
    );
  }

  if (visible.length === 0) {
    return (
      <aside className="rounded-2xl border bg-card/60 p-4 space-y-2 sticky top-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vorschläge
        </div>
        <p className="text-[12px] text-muted-foreground/70">
          Keine offenen Aufgaben passen gerade als Vorschlag. Wichtige neue Mails
          oder Aufgaben mit Fälligkeit landen automatisch hier.
        </p>
      </aside>
    );
  }

  async function handleAdd(suggestion: Suggestion) {
    setDismissed((s) => new Set(s).add(suggestion.id));
    await onAdd(suggestion);
  }

  return (
    <aside className="rounded-2xl border bg-card/60 p-3 space-y-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] flex flex-col">
      {/* Header — auf Mobile klickbar zum Auf-/Zuklappen */}
      <button
        type="button"
        onClick={() => setMobileExpanded((v) => !v)}
        className="flex items-center justify-between gap-2 px-1 shrink-0 lg:cursor-default"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vorschläge
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 tabular-nums">
          {visible.length} {visible.length === 1 ? "Vorschlag" : "Vorschläge"}
          <ChevronDown
            size={12}
            className={`lg:hidden transition-transform ${
              mobileExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      <div
        className={`space-y-1.5 overflow-y-auto pr-1 -mr-1 ${
          mobileExpanded ? "block" : "hidden lg:block"
        } lg:flex-1`}
      >
        {visible.map((s) => {
          const isBusy = busyTaskId === s.id;
          const isOpen = expandedSuggestionId === s.id;
          const descMatch = (s.description ?? "").match(/^Von:\s*[^\n]+\n+([\s\S]*)$/);
          const body = (descMatch?.[1] ?? s.description ?? "").trim();
          return (
            <div
              key={s.id}
              className="group rounded-lg border border-border/50 bg-background/40 hover:border-foreground/15 hover:bg-background/80 transition-colors"
            >
              <div className="flex items-start gap-2 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => handleAdd(s)}
                  disabled={isBusy}
                  className="shrink-0 mt-0.5 w-5 h-5 rounded-full border border-muted-foreground/40 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 grid place-items-center disabled:opacity-50"
                  title="Zu Mein Tag hinzufügen"
                  aria-label="Zu Mein Tag hinzufügen"
                >
                  <span className="text-amber-600 dark:text-amber-400 text-[14px] leading-none font-bold">
                    +
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSuggestionId((cur) => (cur === s.id ? null : s.id))
                  }
                  className="flex-1 min-w-0 text-left"
                  title={isOpen ? "Zuklappen" : "Mehr Details anzeigen"}
                >
                  <div className="text-[12.5px] font-medium leading-snug text-foreground/90 line-clamp-2">
                    {s.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        reasonStyle(s.reason).className
                      }`}
                    >
                      {s.is_important && (
                        <Star size={9} className="fill-current" aria-hidden />
                      )}
                      {s.reason}
                    </span>
                    {s.mail_category && s.mail_category !== "aufgabe" && (
                      <span className="text-[10px] text-muted-foreground/70 capitalize">
                        {s.mail_category}
                      </span>
                    )}
                    {s.priority && s.priority !== "medium" && (
                      <span className="text-[10px] text-muted-foreground/70 capitalize">
                        {s.priority}
                      </span>
                    )}
                  </div>
                </button>
                <ChevronDown
                  size={12}
                  className={`shrink-0 mt-1 text-muted-foreground/40 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </div>
              {isOpen && (
                <div className="border-t border-border/40 px-2.5 py-2 space-y-1.5 bg-muted/20">
                  {body && (
                    <p className="text-[11.5px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
                      {body}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                    {s.due_date && (
                      <span>📅 Fällig: {new Date(s.due_date).toLocaleDateString("de-AT")}</span>
                    )}
                    <span>
                      Erstellt: {new Date(s.created_at).toLocaleDateString("de-AT")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
