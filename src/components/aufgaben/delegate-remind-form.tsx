"use client";

import { useState } from "react";
import { Bell, Check, Loader2, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DelegateRemindFormProps {
  taskId: string;
  currentAssignedTo: string | null;
  currentRemindAt: string | null;
  onUpdated: (next: {
    assigned_to: string | null;
    remind_at: string | null;
  }) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Natural-Language Reminder Parser
//
// Versteht freitext wie:
//   "in 1h" / "in 2 stunden" / "in 30 min"
//   "morgen" / "morgen 9" / "morgen 14:30"
//   "übermorgen" / "uebermorgen"
//   "freitag" / "Mo" / "montag 8:00"
//   "heute abend" / "heute 17"
//   "10.05." / "10.05.2026" / "10.05. 14:00"
//   "+1 woche" / "+2 wochen" / "naechste woche"
// ─────────────────────────────────────────────────────────────────────────────
function parseReminderText(input: string): Date | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const now = new Date();
  const d = new Date(now);

  // 1) "in N min/std/stunden/h"
  const inMatch = s.match(/^in\s+(\d+)\s*(min|m|std|stunden|h|stunde)$/);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    if (unit.startsWith("m") && unit !== "stunden" && unit !== "stunde") {
      d.setMinutes(d.getMinutes() + n);
    } else {
      d.setHours(d.getHours() + n);
    }
    return d;
  }

  // 2) "heute"
  if (s.startsWith("heute")) {
    const tm = s.match(/heute(?:\s+(?:abend|abends))?\s*(\d{1,2})(?::(\d{2}))?/);
    if (tm) {
      d.setHours(parseInt(tm[1], 10), tm[2] ? parseInt(tm[2], 10) : 0, 0, 0);
    } else if (/abend/.test(s)) {
      d.setHours(18, 0, 0, 0);
    }
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }

  // 3) "morgen", "uebermorgen"
  if (s.startsWith("ü") || s.startsWith("u")) {
    if (/^(ü|ue)bermorgen/.test(s)) {
      d.setDate(d.getDate() + 2);
      const tm = s.match(/\s+(\d{1,2})(?::(\d{2}))?$/);
      d.setHours(
        tm ? parseInt(tm[1], 10) : 9,
        tm && tm[2] ? parseInt(tm[2], 10) : 0,
        0,
        0,
      );
      return d;
    }
  }
  if (s.startsWith("morgen")) {
    d.setDate(d.getDate() + 1);
    const tm = s.match(/morgen\s+(\d{1,2})(?::(\d{2}))?/);
    d.setHours(
      tm ? parseInt(tm[1], 10) : 9,
      tm && tm[2] ? parseInt(tm[2], 10) : 0,
      0,
      0,
    );
    return d;
  }

  // 4) Wochentage
  const weekdays = [
    ["sonntag", "so"],
    ["montag", "mo"],
    ["dienstag", "di"],
    ["mittwoch", "mi"],
    ["donnerstag", "do"],
    ["freitag", "fr"],
    ["samstag", "sa"],
  ];
  for (let i = 0; i < 7; i++) {
    if (weekdays[i].some((w) => s.startsWith(w))) {
      const today = d.getDay();
      let delta = i - today;
      if (delta <= 0) delta += 7;
      d.setDate(d.getDate() + delta);
      const tm = s.match(/\s+(\d{1,2})(?::(\d{2}))?$/);
      d.setHours(
        tm ? parseInt(tm[1], 10) : 9,
        tm && tm[2] ? parseInt(tm[2], 10) : 0,
        0,
        0,
      );
      return d;
    }
  }

  // 5) "+N tag(e)/woche(n)"
  const plusMatch = s.match(/^\+?\s*(\d+)\s*(tag|tage|woche|wochen|w)$/);
  if (plusMatch) {
    const n = parseInt(plusMatch[1], 10);
    if (/woche|^w$/.test(plusMatch[2])) {
      d.setDate(d.getDate() + n * 7);
    } else {
      d.setDate(d.getDate() + n);
    }
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (/^(naechste|nächste)\s+woche$/.test(s)) {
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // 6) DD.MM. oder DD.MM.YYYY (+ optional " HH:MM")
  const dm = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*(\d{1,2})?(?::(\d{2}))?$/);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const mon = parseInt(dm[2], 10) - 1;
    const year = dm[3] ? parseInt(dm[3], 10) : d.getFullYear();
    const hr = dm[4] ? parseInt(dm[4], 10) : 9;
    const min = dm[5] ? parseInt(dm[5], 10) : 0;
    const parsed = new Date(year, mon, day, hr, min, 0, 0);
    if (parsed.getTime() < Date.now() && !dm[3]) {
      // Wenn Datum schon vorbei und kein Jahr → naechstes Jahr
      parsed.setFullYear(parsed.getFullYear() + 1);
    }
    return parsed;
  }

  return null;
}

function formatReminderShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  const time = d.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `heute ${time}`;
  if (isTomorrow) return `morgen ${time}`;
  return d.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const QUICK_PRESETS = [
  { key: "1h", label: "+1h" },
  { key: "3h", label: "+3h" },
  { key: "today_evening", label: "Heute 18:00" },
  { key: "tomorrow", label: "Morgen 9:00" },
  { key: "next_week", label: "+1 Woche" },
];

function presetToDate(preset: string): Date {
  const d = new Date();
  switch (preset) {
    case "1h":
      d.setHours(d.getHours() + 1);
      break;
    case "3h":
      d.setHours(d.getHours() + 3);
      break;
    case "today_evening":
      d.setHours(18, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      break;
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      break;
    case "next_week":
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      break;
  }
  return d;
}

export function DelegateRemindForm({
  taskId,
  currentAssignedTo,
  currentRemindAt,
  onUpdated,
}: DelegateRemindFormProps) {
  const [reminderText, setReminderText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegateOpen, setDelegateOpen] = useState(
    Boolean(currentAssignedTo),
  );
  const [assignee, setAssignee] = useState(currentAssignedTo ?? "");
  const [savedFlash, setSavedFlash] = useState(false);

  async function setReminder(date: Date | null) {
    setSaving(true);
    setError(null);
    try {
      const iso = date ? date.toISOString() : null;
      const res = await fetch(`/api/mail-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remind_at: iso }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Fehler ${res.status}`);
        return;
      }
      onUpdated({
        assigned_to: assignee.trim() || null,
        remind_at: iso,
      });
      setReminderText("");
      setParseError(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSaving(false);
    }
  }

  function handleParse() {
    const parsed = parseReminderText(reminderText);
    if (!parsed) {
      setParseError(
        "Nicht verstanden. Versuch z.B. 'morgen 9', 'in 2 std', 'Freitag 14:00'.",
      );
      return;
    }
    setReminder(parsed);
  }

  async function saveDelegation() {
    setSaving(true);
    setError(null);
    try {
      const trimmed = assignee.trim();
      const res = await fetch(`/api/mail-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: trimmed.length > 0 ? trimmed : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Fehler ${res.status}`);
        return;
      }
      onUpdated({
        assigned_to: trimmed.length > 0 ? trimmed : null,
        remind_at: currentRemindAt,
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── Erinnern: kompakte 1-Zeile ─────────────────────────────────── */}
      <div className="rounded-lg border bg-card/40 px-2.5 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Bell size={11} className="text-amber-500" />
          <span>Erinnern</span>
          {currentRemindAt && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-amber-700 dark:text-amber-300 font-medium">
              {formatReminderShort(currentRemindAt)}
              <button
                type="button"
                onClick={() => setReminder(null)}
                className="hover:text-rose-600 p-0.5 rounded"
                title="Erinnerung löschen"
                aria-label="Erinnerung löschen"
              >
                <X size={10} />
              </button>
            </span>
          )}
          {savedFlash && !currentRemindAt && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-emerald-600 dark:text-emerald-400">
              <Check size={10} /> gespeichert
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {QUICK_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={saving}
              onClick={() => setReminder(presetToDate(p.key))}
              className="text-[10.5px] px-2 py-0.5 rounded-md border border-border/60 bg-background/40 hover:bg-amber-50 hover:border-amber-400 dark:hover:bg-amber-950/40 dark:hover:border-amber-700 transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
          {/* Schmales Free-Text-Feld: 'in 2 std', 'morgen 9', 'Freitag 14' */}
          <div className="flex-1 min-w-[140px] flex items-center gap-1">
            <Input
              placeholder="z.B. morgen 9 / in 2 std / Freitag 14"
              value={reminderText}
              onChange={(e) => {
                setReminderText(e.target.value);
                setParseError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleParse();
                }
              }}
              className="h-7 text-[12px] px-2"
              disabled={saving}
            />
            {reminderText && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={handleParse}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  "Setzen"
                )}
              </Button>
            )}
          </div>
        </div>
        {parseError && (
          <p className="text-[10.5px] text-amber-700 dark:text-amber-400">
            {parseError}
          </p>
        )}
      </div>

      {/* ─── Delegieren: collapsed by default ───────────────────────────── */}
      {!delegateOpen ? (
        <button
          type="button"
          onClick={() => setDelegateOpen(true)}
          className="w-full rounded-lg border bg-card/40 hover:bg-card/80 hover:border-foreground/15 transition-colors px-2.5 py-2 flex items-center gap-2 text-left text-[11px] text-muted-foreground"
          title="An Mitarbeiter delegieren"
        >
          <UserCheck size={11} className="opacity-70" />
          <span>Delegieren</span>
          {currentAssignedTo && (
            <span className="ml-auto text-[10.5px] text-foreground/80 truncate max-w-[140px]">
              → {currentAssignedTo}
            </span>
          )}
          {!currentAssignedTo && (
            <span className="ml-auto opacity-60 text-[10px]">öffnen</span>
          )}
        </button>
      ) : (
        <div className="rounded-lg border bg-card/40 px-2.5 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <UserCheck size={11} className="text-blue-500" />
            <span>Delegieren an</span>
            <button
              type="button"
              onClick={() => setDelegateOpen(false)}
              className="ml-auto p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60"
              title="Zuklappen"
              aria-label="Zuklappen"
            >
              <X size={11} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="Name oder Email"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveDelegation();
                }
              }}
              className="h-7 text-[12px] px-2 flex-1"
              maxLength={200}
              disabled={saving}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={saveDelegation}
              disabled={saving || assignee.trim() === (currentAssignedTo ?? "")}
            >
              {saving ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                "Speichern"
              )}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10.5px] text-rose-600 dark:text-rose-400 px-1">
          {error}
        </p>
      )}
    </div>
  );
}
