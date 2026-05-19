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
          <DateTimePicker
            value={remindAt}
            onChange={setRemindAt}
            placeholder="z. B. morgen 9:00"
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
