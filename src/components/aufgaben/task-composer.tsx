"use client";

import { useState } from "react";
import {
  Check,
  Loader2,
  Mail,
  Pen,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  taskId: string;
  /** Bei „Per Outlook antworten" wird dieser Link genutzt — Caller stellt
   *  vorbefuellten mailto-Link bereit oder null wenn kein Sender da. */
  mailto: string | null;
  /** Nach erfolgreichem Speichern wollen wir die Karte auf 'done' bringen
   *  (Auto-Erledigung — Item 3.3). Caller entscheidet ob das passiert. */
  onActionCompleted?: () => void;
}

type ToneOpt = "freundlich" | "kurz" | "foermlich";

/**
 * Inline-Composer am expanded TaskCard.
 *
 * 3 Aktionen:
 *  1. „KI-Antwort generieren" → Claude Haiku, Hint optional, Draft kommt
 *     direkt in die Textarea
 *  2. „Notiz speichern" → POST /notes, kind='note'
 *  3. „Per Outlook antworten" → mailto-Link wird im Outlook geoeffnet
 *     (mit dem aktuellen Textarea-Inhalt als Body)
 *
 * Status-Badges + auto-clear nach 2s damit's nicht klebt.
 */
export function TaskComposer({ taskId, mailto, onActionCompleted }: Props) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [tone, setTone] = useState<ToneOpt>("freundlich");
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState<"ai" | "note" | "mail" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function flashOk(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2000);
  }

  async function generateAiDraft() {
    setBusy("ai");
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/ai-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint: hint.trim(), tone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Fehler ${res.status}`);
        return;
      }
      // Vorhandenen Text NICHT ersetzen wenn schon was drin steht — danach
      // anhaengen. Falls leer: Draft direkt rein.
      if (text.trim().length > 0) {
        setText((t) => `${t}\n\n${json.draft}`);
      } else {
        setText(json.draft);
      }
      flashOk("KI-Entwurf eingefügt");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    const body = text.trim();
    if (!body) {
      setError("Notiz ist leer");
      return;
    }
    setBusy("note");
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, kind: "note" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Fehler ${res.status}`);
        return;
      }
      flashOk("Notiz gespeichert");
      setText("");
      onActionCompleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(null);
    }
  }

  async function sendViaOutlook() {
    if (!mailto) {
      setError("Kein Absender — Outlook-Reply nicht möglich");
      return;
    }
    const body = text.trim();
    if (!body) {
      setError("Mail-Text ist leer");
      return;
    }
    setBusy("mail");
    setError(null);
    try {
      // mailto-Link um body erweitern. Wenn der Caller bereits ?subject= etc.
      // mitgegeben hat, append wir &body=… (URL-encoded).
      const separator = mailto.includes("?") ? "&" : "?";
      const finalLink = `${mailto}${separator}body=${encodeURIComponent(body)}`;
      // Notiz als 'mailto' kind speichern fuer History
      await fetch(`/api/mail-tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, kind: "mailto" }),
      }).catch(() => {});
      window.location.href = finalLink;
      flashOk("Outlook wird geöffnet");
      onActionCompleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Öffnen");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-xl border bg-card/50 p-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 inline-flex items-center gap-1.5">
          <Pen size={11} /> Antwort / Notiz
        </p>
        <div className="flex items-center gap-1.5">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as ToneOpt)}
            className="h-7 text-[10px] rounded-md bg-background border border-input px-2"
            title="Tonfall für KI-Entwurf"
          >
            <option value="freundlich">Freundlich</option>
            <option value="kurz">Kurz & sachlich</option>
            <option value="foermlich">Förmlich</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] gap-1 px-2"
            onClick={() => setShowHint((s) => !s)}
            title="Stichworte für die KI hinzufügen"
          >
            {showHint ? "Stichworte ein" : "+ Stichworte"}
          </Button>
        </div>
      </div>

      {showHint && (
        <Textarea
          placeholder="Stichworte für die KI (was soll in die Antwort rein?) — optional"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          rows={2}
          className="text-[12.5px] resize-none"
          maxLength={1000}
        />
      )}

      <Textarea
        placeholder="Antwort tippen oder KI-Entwurf generieren…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="text-[13px] resize-y min-h-[100px]"
        maxLength={4000}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={generateAiDraft}
          disabled={busy !== null}
          title="Claude Haiku schreibt einen Antwort-Entwurf basierend auf dem Task-Inhalt"
        >
          {busy === "ai" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> KI denkt…
            </>
          ) : (
            <>
              <Sparkles size={12} /> KI-Entwurf
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={saveNote}
          disabled={busy !== null || text.trim().length === 0}
          title="Als interne Notiz speichern (kein Mail-Versand)"
        >
          {busy === "note" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Speichert…
            </>
          ) : (
            <>
              <Save size={12} /> Notiz speichern
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="default"
          className="h-8 gap-1.5 ml-auto"
          onClick={sendViaOutlook}
          disabled={busy !== null || !mailto || text.trim().length === 0}
          title={
            !mailto
              ? "Kein Absender — kein Outlook-Reply möglich"
              : "Öffnet Outlook mit dem Text als Antwort"
          }
        >
          {busy === "mail" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Öffnet…
            </>
          ) : (
            <>
              <Mail size={12} /> Per Outlook antworten
            </>
          )}
        </Button>
        {text.length > 0 && busy === null && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-rose-600"
            onClick={() => {
              setText("");
              setError(null);
            }}
            title="Textfeld leeren"
          >
            <Trash2 size={11} /> Verwerfen
          </Button>
        )}
      </div>

      {flash && (
        <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
          <Check size={11} /> {flash}
        </div>
      )}
      {error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
