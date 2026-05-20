"use client";

import { useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Loader2,
  UserCheck,
  X,
  Mail,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DelegateRemindFormProps {
  taskId: string;
  currentAssignedTo: string | null;
  currentRemindAt: string | null;
  onUpdated: (next: { assigned_to: string | null; remind_at: string | null }) => void;
  /** Aufgabentitel — fuer Delegations-Mail-Betreff */
  taskTitle?: string;
  /** Originalinhalt der Mail — wird als Zitat unten eingefuegt */
  taskBody?: string | null;
  /** Absender-Email — fuer mailto: */
  senderEmail?: string | null;
  /** Hero-Projekt-UUID — aktiviert "In Hero schreiben"-Option */
  heroProjectId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bekannte Team-Mitglieder fuer Vorschlaege
// ─────────────────────────────────────────────────────────────────────────────
const TEAM_SUGGESTIONS = [
  { name: "Domenic", email: "d.wagenleitner@jumax-elektro.de" },
  { name: "Paul",    email: "p.wagenleitner@jumax-elektro.de" },
  { name: "Eric",    email: "e.lenz@jumax-elektro.de" },
  { name: "Stefan",  email: "s.beckstedt@jumax-elektro.de" },
  { name: "Jan",     email: "j.lichtner@jumax-elektro.de" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Natural-Language Reminder Parser
// ─────────────────────────────────────────────────────────────────────────────
function parseReminderText(input: string): Date | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const now = new Date();
  const d = new Date(now);

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

  if (/^(ü|ue)bermorgen/.test(s)) {
    d.setDate(d.getDate() + 2);
    const tm = s.match(/\s+(\d{1,2})(?::(\d{2}))?$/);
    d.setHours(tm ? parseInt(tm[1], 10) : 9, tm?.[2] ? parseInt(tm[2], 10) : 0, 0, 0);
    return d;
  }
  if (s.startsWith("morgen")) {
    d.setDate(d.getDate() + 1);
    const tm = s.match(/morgen\s+(\d{1,2})(?::(\d{2}))?/);
    d.setHours(tm ? parseInt(tm[1], 10) : 9, tm?.[2] ? parseInt(tm[2], 10) : 0, 0, 0);
    return d;
  }

  const weekdays = [
    ["sonntag", "so"], ["montag", "mo"], ["dienstag", "di"],
    ["mittwoch", "mi"], ["donnerstag", "do"], ["freitag", "fr"], ["samstag", "sa"],
  ];
  for (let i = 0; i < 7; i++) {
    if (weekdays[i].some((w) => s.startsWith(w))) {
      const today = d.getDay();
      let delta = i - today;
      if (delta <= 0) delta += 7;
      d.setDate(d.getDate() + delta);
      const tm = s.match(/\s+(\d{1,2})(?::(\d{2}))?$/);
      d.setHours(tm ? parseInt(tm[1], 10) : 9, tm?.[2] ? parseInt(tm[2], 10) : 0, 0, 0);
      return d;
    }
  }

  const plusMatch = s.match(/^\+?\s*(\d+)\s*(tag|tage|woche|wochen|w)$/);
  if (plusMatch) {
    const n = parseInt(plusMatch[1], 10);
    if (/woche|^w$/.test(plusMatch[2])) d.setDate(d.getDate() + n * 7);
    else d.setDate(d.getDate() + n);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (/^(naechste|nächste)\s+woche$/.test(s)) {
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  const dm = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*(\d{1,2})?(?::(\d{2}))?$/);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const mon = parseInt(dm[2], 10) - 1;
    const year = dm[3] ? parseInt(dm[3], 10) : d.getFullYear();
    const hr = dm[4] ? parseInt(dm[4], 10) : 9;
    const min = dm[5] ? parseInt(dm[5], 10) : 0;
    const parsed = new Date(year, mon, day, hr, min, 0, 0);
    if (parsed.getTime() < Date.now() && !dm[3]) parsed.setFullYear(parsed.getFullYear() + 1);
    return parsed;
  }
  return null;
}

function formatReminderShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `heute ${time}`;
  if (isTomorrow) return `morgen ${time}`;
  return d.toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const QUICK_PRESETS = [
  { key: "1h",           label: "+1h" },
  { key: "3h",           label: "+3h" },
  { key: "today_evening",label: "18:00" },
  { key: "tomorrow",     label: "Morgen" },
  { key: "next_week",    label: "+1W" },
];

function presetToDate(preset: string): Date {
  const d = new Date();
  switch (preset) {
    case "1h":           d.setHours(d.getHours() + 1); break;
    case "3h":           d.setHours(d.getHours() + 3); break;
    case "today_evening":d.setHours(18, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); break;
    case "tomorrow":     d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); break;
    case "next_week":    d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); break;
  }
  return d;
}

/** Baut eine Delegations-Mail: kurzer Text + Original als Zitat */
function buildDelegationEmail(params: {
  toName: string;
  taskTitle: string;
  taskBody: string | null;
}): string {
  const greeting = `Hey ${params.toName},\n\nkannst du dich bitte darum kümmern? Wenn du Fragen hast, bin ich für dich da.\n\nViele Grüße, Domenic`;
  if (!params.taskBody?.trim()) return greeting;
  const bodyTrimmed = params.taskBody.slice(0, 500).trim();
  const quote = bodyTrimmed
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return `${greeting}\n\n─── Original: ${params.taskTitle} ───\n${quote}`;
}

export function DelegateRemindForm({
  taskId,
  currentAssignedTo,
  currentRemindAt,
  onUpdated,
  taskTitle = "",
  taskBody = null,
  senderEmail = null,
  heroProjectId = null,
}: DelegateRemindFormProps) {
  const [reminderText, setReminderText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegateOpen, setDelegateOpen] = useState(Boolean(currentAssignedTo));
  const [assignee, setAssignee] = useState(currentAssignedTo ?? "");
  const [assigneeEmail, setAssigneeEmail] = useState<string>("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [delegationText, setDelegationText] = useState("");
  const [heroSending, setHeroSending] = useState(false);

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
      onUpdated({ assigned_to: assignee.trim() || null, remind_at: iso });
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
      setParseError("Nicht verstanden — z.B. 'morgen 9', 'in 2 std', 'Fr 14'");
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
        body: JSON.stringify({ assigned_to: trimmed.length > 0 ? trimmed : null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Fehler ${res.status}`);
        return;
      }
      onUpdated({ assigned_to: trimmed.length > 0 ? trimmed : null, remind_at: currentRemindAt });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSaving(false);
    }
  }

  function selectTeamMember(member: { name: string; email: string }) {
    setAssignee(member.name);
    setAssigneeEmail(member.email);
    const draft = buildDelegationEmail({
      toName: member.name,
      taskTitle,
      taskBody,
    });
    setDelegationText(draft);
  }

  function openOutlook() {
    if (!delegationText.trim()) return;
    const to = assigneeEmail || senderEmail || "";
    const subject = encodeURIComponent(`Delegiert: ${taskTitle}`);
    const body = encodeURIComponent(delegationText);
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
    // Aufgabe direkt nach Outlook-Öffnen delegiert speichern
    if (assignee.trim()) saveDelegation();
  }

  async function sendToHeroLog() {
    if (!heroProjectId || !delegationText.trim()) return;
    setHeroSending(true);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/hero-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Delegiert an ${assignee || "Mitarbeiter"}: ${taskTitle}`.slice(0, 200),
          text: delegationText.slice(0, 4000),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || `Hero Fehler ${res.status}`); return; }
      if (assignee.trim()) await saveDelegation();
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setHeroSending(false);
    }
  }

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>

      {/* ─── Erinnern ─────────────────────────────────────────────────────── */}
      <div className="rounded-md border bg-card/40 px-2 py-1.5 space-y-1">
        <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <Bell size={10} className="text-amber-500" />
          <span className="font-medium">Erinnern</span>
          {currentRemindAt && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-medium">
              {formatReminderShort(currentRemindAt)}
              <button
                type="button"
                onClick={() => setReminder(null)}
                className="hover:text-rose-600 p-0.5 rounded"
                title="Löschen"
              >
                <X size={9} />
              </button>
            </span>
          )}
          {savedFlash && !currentRemindAt && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Check size={9} /> ok
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
              className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-background/40 hover:bg-amber-50 hover:border-amber-400 dark:hover:bg-amber-950/40 dark:hover:border-amber-700 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
          {/* Kalender-Picker: natives datetime-local hinter Icon-Button */}
          <label
            className="inline-flex items-center justify-center h-[22px] w-[22px] rounded border border-border/60 bg-background/40 hover:bg-amber-50 hover:border-amber-400 dark:hover:bg-amber-950/40 dark:hover:border-amber-700 transition-colors cursor-pointer"
            title="Datum aus Kalender wählen"
          >
            <CalendarDays size={11} className="text-muted-foreground pointer-events-none" />
            <input
              type="datetime-local"
              className="absolute opacity-0 w-px h-px overflow-hidden"
              disabled={saving}
              onChange={(e) => {
                if (e.target.value) {
                  setReminder(new Date(e.target.value));
                  e.target.value = "";
                }
              }}
            />
          </label>
          <div className="flex-1 min-w-[120px] flex items-center gap-1">
            <Input
              placeholder="morgen 9 / in 2 std / Fr 14"
              value={reminderText}
              onChange={(e) => { setReminderText(e.target.value); setParseError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleParse(); } }}
              className="h-6 text-[11px] px-1.5"
              disabled={saving}
            />
            {reminderText && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-1.5 text-[10px]"
                onClick={handleParse}
                disabled={saving}
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : "✓"}
              </Button>
            )}
          </div>
        </div>
        {parseError && (
          <p className="text-[10px] text-amber-700 dark:text-amber-400">{parseError}</p>
        )}
      </div>

      {/* ─── Delegieren ───────────────────────────────────────────────────── */}
      {!delegateOpen ? (
        <button
          type="button"
          onClick={() => setDelegateOpen(true)}
          className="w-full rounded-md border bg-card/40 hover:bg-card/80 transition-colors px-2 py-1.5 flex items-center gap-1.5 text-left text-[10.5px] text-muted-foreground"
        >
          <UserCheck size={10} className="opacity-70" />
          <span className="font-medium">Delegieren</span>
          {currentAssignedTo && (
            <span className="ml-auto text-[10px] text-foreground/80 truncate max-w-[120px]">
              → {currentAssignedTo}
            </span>
          )}
          <ChevronDown size={10} className="ml-auto opacity-50 shrink-0" />
        </button>
      ) : (
        <div className="rounded-md border bg-card/40 px-2 py-1.5 space-y-1.5">
          {/* Header */}
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <UserCheck size={10} className="text-blue-500" />
            <span className="font-medium">Delegieren an</span>
            <button
              type="button"
              onClick={() => setDelegateOpen(false)}
              className="ml-auto p-0.5 rounded hover:bg-muted/60"
            >
              <ChevronUp size={10} />
            </button>
          </div>

          {/* Team-Vorschläge */}
          <div className="flex flex-wrap gap-1">
            {TEAM_SUGGESTIONS.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => selectTeamMember(m)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                  assignee === m.name
                    ? "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300"
                    : "border-border/60 bg-background/40 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* Name-Input (manuell) */}
          <div className="flex items-center gap-1">
            <Input
              placeholder="Oder Namen eingeben…"
              value={assignee}
              onChange={(e) => {
                setAssignee(e.target.value);
                // Delegationstext aktualisieren wenn Name sich ändert
                if (e.target.value.trim()) {
                  setDelegationText(
                    buildDelegationEmail({ toName: e.target.value.trim(), taskTitle, taskBody })
                  );
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveDelegation(); } }}
              className="h-6 text-[11px] px-1.5 flex-1"
              maxLength={200}
              disabled={saving}
            />
          </div>

          {/* Delegations-Text (editierbar) */}
          {delegationText && (
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground font-medium">Nachricht:</div>
              <textarea
                value={delegationText}
                onChange={(e) => setDelegationText(e.target.value)}
                rows={4}
                className="w-full text-[11px] px-1.5 py-1 rounded border bg-background/60 resize-y min-h-[70px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {/* Aktions-Buttons */}
          {assignee.trim() && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {/* Nur speichern (ohne Mail) */}
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px]"
                onClick={saveDelegation}
                disabled={saving || assignee.trim() === (currentAssignedTo ?? "")}
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : (
                  <><Check size={10} /> Speichern</>
                )}
              </Button>

              {/* Outlook öffnen */}
              {delegationText && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={openOutlook}
                >
                  <Mail size={10} /> Outlook
                </Button>
              )}

              {/* Hero Logbuch */}
              {heroProjectId && delegationText && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-[10px] gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={sendToHeroLog}
                  disabled={heroSending}
                >
                  {heroSending
                    ? <Loader2 size={10} className="animate-spin" />
                    : <><BookOpen size={10} /> Hero</>
                  }
                </Button>
              )}

              {savedFlash && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                  <Check size={9} /> gespeichert
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-[10px] text-rose-600 dark:text-rose-400 px-0.5">{error}</p>
      )}
    </div>
  );
}
