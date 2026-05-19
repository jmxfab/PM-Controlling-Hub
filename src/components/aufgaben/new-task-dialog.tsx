"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewTaskDialogProps {
  /** Wird nach erfolgreichem Anlegen aufgerufen, damit die Liste refreshed wird. */
  onCreated?: () => void;
}

const CATEGORIES = [
  { value: "aufgabe", label: "Aufgabe" },
  { value: "dringend", label: "Dringend" },
  { value: "kritisch", label: "Kritisch" },
  { value: "info", label: "Info" },
  { value: "rechnung", label: "Bestellung & Rechnung" },
] as const;

const PRIORITIES = [
  { value: "urgent", label: "Dringend (rot)" },
  { value: "high", label: "Hoch (orange)" },
  { value: "medium", label: "Mittel (amber)" },
  { value: "low", label: "Niedrig (grau)" },
] as const;

/**
 * "+ Neue Aufgabe"-Button + Dialog mit Form.
 * Standard-Default: Aufgabe/Mittel/keine Deadline.
 */
export function NewTaskDialog({ onCreated }: NewTaskDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    mail_category: "aufgabe" as string,
    priority: "medium" as string,
    due_date: "",
    assigned_to: "",
    remind_at: "",
  });

  function reset() {
    setForm({
      title: "",
      description: "",
      mail_category: "aufgabe",
      priority: "medium",
      due_date: "",
      assigned_to: "",
      remind_at: "",
    });
    setError(null);
  }

  async function submit() {
    if (!form.title.trim()) {
      setError("Titel ist Pflicht");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, string | null> = {
        title: form.title.trim(),
        description: form.description.trim() || "",
        mail_category: form.mail_category,
        priority: form.priority,
      };
      if (form.due_date) payload.due_date = new Date(form.due_date).toISOString();
      if (form.assigned_to.trim()) payload.assigned_to = form.assigned_to.trim();
      if (form.remind_at) payload.remind_at = new Date(form.remind_at).toISOString();

      const res = await fetch("/api/mail-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      reset();
      setOpen(false);
      if (onCreated) {
        onCreated();
      } else {
        // Server-Components-Page neu fetchen damit die neue Aufgabe erscheint
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 shadow-sm">
          <Plus size={15} />
          Neue Aufgabe
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Sparkles size={18} />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-xl font-bold tracking-tight">
                Neue Aufgabe
              </DialogTitle>
              <DialogDescription className="text-xs">
                Manuell angelegt · landet sofort im passenden Tab
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Titel */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs font-medium">
              Titel <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Was muss erledigt werden?"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              maxLength={200}
              autoFocus
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc" className="text-xs font-medium">
              Beschreibung
            </Label>
            <Textarea
              id="task-desc"
              placeholder="Zusatzkontext · Hintergrund · was genau zu tun ist…"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={4}
              maxLength={4000}
            />
          </div>

          {/* Kategorie + Prio nebeneinander */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Kategorie</Label>
              <Select
                value={form.mail_category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, mail_category: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Priorität</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Delegieren + Erinnerung */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee" className="text-xs font-medium">
                Delegieren an
              </Label>
              <Input
                id="task-assignee"
                placeholder="z. B. Maik, Andrea…"
                value={form.assigned_to}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assigned_to: e.target.value }))
                }
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-remind" className="text-xs font-medium">
                Erinnern am
              </Label>
              <DateTimePicker
                value={form.remind_at}
                onChange={(v) => setForm((f) => ({ ...f, remind_at: v }))}
                placeholder="z. B. morgen 9:00"
              />
            </div>
          </div>

          {/* Fälligkeit */}
          <div className="space-y-1.5">
            <Label htmlFor="task-due" className="text-xs font-medium">
              Fälligkeitsdatum
            </Label>
            <DateTimePicker
              value={form.due_date}
              onChange={(v) => setForm((f) => ({ ...f, due_date: v }))}
              placeholder="Fälligkeitsdatum"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Abbrechen
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Wird gespeichert…
                </>
              ) : (
                "Aufgabe anlegen"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
