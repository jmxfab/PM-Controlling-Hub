"use client";

import { useState } from "react";
import { Bell, BellOff, Check, Loader2, UserCheck, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface DelegateRemindFormProps {
  taskId: string;
  currentAssignedTo: string | null;
  currentRemindAt: string | null;
  /** Nach erfolgreichem PATCH wird der parent-State aktualisiert */
  onUpdated: (next: {
    assigned_to: string | null;
    remind_at: string | null;
  }) => void;
}

/** Format ISO -> 'YYYY-MM-DDTHH:mm' für datetime-local input. */
function toInputDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Liefert ein Date Object fuer einen Quick-Pick-Preset. */
function presetDate(preset: string): Date {
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
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); // wenn schon vorbei
      break;
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      break;
    case "day_after_tomorrow":
      d.setDate(d.getDate() + 2);
      d.setHours(9, 0, 0, 0);
      break;
    case "next_monday": {
      const dow = d.getDay(); // 0 So, 1 Mo
      const daysToMon = ((1 - dow + 7) % 7) || 7;
      d.setDate(d.getDate() + daysToMon);
      d.setHours(9, 0, 0, 0);
      break;
    }
    case "next_week":
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      break;
    case "in_2_weeks":
      d.setDate(d.getDate() + 14);
      d.setHours(9, 0, 0, 0);
      break;
  }
  return d;
}

const REMINDER_PRESETS: Array<{ key: string; label: string }> = [
  { key: "1h", label: "+1 Std" },
  { key: "3h", label: "+3 Std" },
  { key: "today_evening", label: "Heute 18:00" },
  { key: "tomorrow", label: "Morgen 9:00" },
  { key: "day_after_tomorrow", label: "Übermorgen" },
  { key: "next_monday", label: "Nächster Montag" },
  { key: "next_week", label: "+1 Woche" },
  { key: "in_2_weeks", label: "+2 Wochen" },
];

/**
 * Inline-Form im expanded TaskCard: Delegieren an wen + Erinnerung wann.
 * Optimistic update + revert on error.
 */
export function DelegateRemindForm({
  taskId,
  currentAssignedTo,
  currentRemindAt,
  onUpdated,
}: DelegateRemindFormProps) {
  const [assignee, setAssignee] = useState(currentAssignedTo ?? "");
  const [remindAt, setRemindAt] = useState(toInputDateTime(currentRemindAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty =
    assignee.trim() !== (currentAssignedTo ?? "") ||
    remindAt !== toInputDateTime(currentRemindAt);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string | null> = {};
      const trimmedAssignee = assignee.trim();
      body.assigned_to = trimmedAssignee.length > 0 ? trimmedAssignee : null;
      body.remind_at = remindAt ? new Date(remindAt).toISOString() : null;

      const res = await fetch(`/api/mail-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      onUpdated({
        assigned_to: body.assigned_to,
        remind_at: body.remind_at,
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSaving(false);
    }
  }

  /** Quick-Preset waehlen: setzt remind_at + speichert SOFORT (kein extra
   *  'Speichern'-Klick noetig). */
  async function applyPreset(presetKey: string) {
    const date = presetDate(presetKey);
    const iso = date.toISOString();
    setRemindAt(toInputDateTime(iso));
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remind_at: iso }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      onUpdated({
        assigned_to: assignee.trim() || null,
        remind_at: iso,
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function clearAll() {
    setSaving(true);
    setError(null);
    setAssignee("");
    setRemindAt("");
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: null, remind_at: null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      onUpdated({ assigned_to: null, remind_at: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl border bg-card/50 p-3 space-y-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Delegieren & Erinnerung
        </p>
        {(currentAssignedTo || currentRemindAt) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-rose-600 ml-auto"
            disabled={saving}
            onClick={clearAll}
            title="Delegation + Erinnerung loeschen"
          >
            <X size={11} /> Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <UserCheck size={10} /> Delegiert an
          </label>
          <Input
            placeholder="Name oder Email"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="h-8 text-sm"
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Bell size={10} /> Erinnern am
          </label>
          {/* Quick-Presets — ein Klick = sofort gespeichert */}
          <div className="flex flex-wrap gap-1 mb-1">
            {REMINDER_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={saving}
                onClick={() => applyPreset(p.key)}
                className="text-[10.5px] px-2 py-0.5 rounded-full border border-border/60 bg-background/50 hover:bg-amber-50 hover:border-amber-400 dark:hover:bg-amber-950/40 dark:hover:border-amber-700 transition-colors disabled:opacity-50"
                title={`Erinnerung in ${p.label} setzen + speichern`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <DateTimePicker
            value={remindAt}
            onChange={setRemindAt}
            placeholder="… oder benutzerdefiniert"
            className="w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          className="h-7 gap-1.5"
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Speichert…
            </>
          ) : savedFlash ? (
            <>
              <Check size={12} /> Gespeichert
            </>
          ) : (
            "Speichern"
          )}
        </Button>
        {error && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>
    </div>
  );
}
