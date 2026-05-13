"use client";

import { useState } from "react";
import { ListChecks, Loader2, Sparkles, RotateCcw, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Subtask } from "@/lib/supabase/mail-tasks-queries";

interface SubtaskListProps {
  taskId: string;
  initialSubtasks: Subtask[];
  /** Optimistic toggle vom Parent — wird mit den server-bestaetigten Subtasks aktualisiert */
  onSubtasksChange: (next: Subtask[]) => void;
}

/**
 * Subtask-Checkliste fuer einen expandierten Task.
 * - Wenn leer: "Schritte generieren"-Button (ruft Claude via POST)
 * - Wenn gefuellt: Checkbox-Liste mit Toggle, Regenerate, Reset
 *
 * Optimistic Updates: Toggle sofort lokal sichtbar, im Hintergrund PATCH.
 * Bei Fehler: revert + Error-Message inline.
 */
export function SubtaskList({ taskId, initialSubtasks, onSubtasksChange }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(next: Subtask[]) {
    setSubtasks(next);
    onSubtasksChange(next);
  }

  async function generate(regenerate = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      update((json.subtasks as Subtask[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(subtaskId: string, currentDone: boolean) {
    // Optimistic
    const optimistic = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !currentDone } : s,
    );
    update(optimistic);
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/subtasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtaskId, done: !currentDone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Revert
        update(subtasks);
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      // Server-Wahrheit uebernehmen
      update((json.subtasks as Subtask[]) ?? optimistic);
    } catch (e) {
      update(subtasks);
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    }
  }

  async function clearAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/subtasks`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      update([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }

  // Empty State
  if (subtasks.length === 0) {
    return (
      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            generate(false);
          }}
        >
          {loading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Claude denkt nach…
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-violet-500" />
              In Schritte zerlegen
            </>
          )}
        </Button>
        {error && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>
    );
  }

  const allDone = subtasks.every((s) => s.done);
  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <div
      className="space-y-2 rounded-xl border bg-card/50 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <ListChecks
            size={13}
            className={
              allDone
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }
          />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Checkliste
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {doneCount} / {subtasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              generate(true);
            }}
            title="Schritte neu generieren (alter Stand wird ueberschrieben)"
          >
            <RotateCcw size={11} />
            Neu
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-rose-600"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            title="Alle Schritte loeschen"
          >
            <Trash2 size={11} />
          </Button>
        </div>
      </div>

      {/* Mini Progress-Bar */}
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
          style={{
            width:
              subtasks.length === 0
                ? "0%"
                : `${(doneCount / subtasks.length) * 100}%`,
          }}
        />
      </div>

      <ul className="space-y-1 pt-1">
        {subtasks.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(s.id, s.done);
              }}
              className={`group w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                s.done
                  ? "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                  : "hover:bg-muted/40"
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 grid place-items-center w-4 h-4 rounded border-2 transition-all ${
                  s.done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-muted-foreground/30 group-hover:border-foreground/50"
                }`}
              >
                {s.done && <Check size={10} strokeWidth={3} />}
              </span>
              <span
                className={`flex-1 leading-snug ${
                  s.done ? "line-through" : ""
                }`}
              >
                {s.title}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400 pt-1">
          {error}
        </p>
      )}
    </div>
  );
}
