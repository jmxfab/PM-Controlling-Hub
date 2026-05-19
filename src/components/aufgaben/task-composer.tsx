"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  FileText,
  Loader2,
  Mail,
  Pen,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface TemplateOpt {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  body: string;
  tag: string | null;
}

/** Extrahiert {{var}}-Platzhalter aus dem Text — unique, in Reihenfolge. */
function extractPlaceholders(text: string): string[] {
  const re = /\{\{\s*([a-zA-Z0-9_äöüÄÖÜß]+)\s*\}\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Ersetzt {{var}} durch die Werte aus dem record. Unbekannte bleiben stehen
 *  damit der User sieht was noch nicht ausgefuellt ist. */
function substitute(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_äöüÄÖÜß]+)\s*\}\}/g, (_full, name) => {
    const v = values[name];
    return v && v.length > 0 ? v : `{{${name}}}`;
  });
}

interface Props {
  taskId: string;
  /** Bei „Per Outlook antworten" wird dieser Link genutzt — Caller stellt
   *  vorbefuellten mailto-Link bereit oder null wenn kein Sender da. */
  mailto: string | null;
  /** Wird aufgerufen wenn der User die Auto-Done-Checkbox aktiviert hat
   *  UND eine Aktion (Notiz/Outlook) erfolgreich war. Caller PATCHt dann
   *  status=done. Item 3.3 aus Roadmap. */
  onActionCompleted?: () => void;
  /** Wird aufgerufen wenn der User auf "An Controlling delegieren" klickt —
   *  PATCH status='controlling'. */
  onMarkControlling?: () => void;
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
export function TaskComposer({
  taskId,
  mailto,
  onActionCompleted,
  onMarkControlling,
}: Props) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [tone, setTone] = useState<ToneOpt>("freundlich");
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState<"ai" | "note" | "mail" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /** Wenn gesetzt, nach erfolgreichem Save/Send -> Task auf done.
   *  Default: true wenn mailto vorhanden (User will dann meist die Mail-Pflicht
   *  abhaken), false bei reiner Notiz. */
  const [autoDone, setAutoDone] = useState<boolean>(true);
  // Templates + Variable-State
  const [templates, setTemplates] = useState<TemplateOpt[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [tplVars, setTplVars] = useState<Record<string, string>>({});
  const [tplRawBody, setTplRawBody] = useState<string>("");

  // Templates beim Mount lazy laden — leichtgewichtig, gecached
  useEffect(() => {
    let cancelled = false;
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j?.templates)) {
          setTemplates(j.templates as TemplateOpt[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const placeholders = useMemo(
    () => (tplRawBody ? extractPlaceholders(tplRawBody) : []),
    [tplRawBody],
  );

  function applyTemplate(tplId: string) {
    setSelectedTplId(tplId);
    setError(null);
    if (!tplId) {
      setTplRawBody("");
      setTplVars({});
      return;
    }
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setTplRawBody(tpl.body);
    // Auto-fill: datum + uhrzeit als Defaults wenn drin
    const now = new Date();
    const defaults: Record<string, string> = {
      datum: now.toLocaleDateString("de-AT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      uhrzeit: now.toLocaleTimeString("de-AT", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const ph = extractPlaceholders(tpl.body);
    const init: Record<string, string> = {};
    for (const name of ph) {
      init[name] = defaults[name.toLowerCase()] ?? "";
    }
    setTplVars(init);
    // Initialen Substitutions-Text in die Textarea schreiben
    setText(substitute(tpl.body, init));
  }

  // Wenn der User in den Variablen tippt -> Text live re-rendern (aber NUR
  // wenn er nicht selbst manuell den Text editiert hat). Heuristik:
  // wir setzen text immer neu wenn placeholders > 0 und kein manueller Override.
  // Einfacher: ein "Übernehmen"-Button — kein Auto-Re-Render damit der User
  // nicht plötzlich seinen handgeschriebenen Text verliert.
  function applyVariables() {
    if (!tplRawBody) return;
    setText(substitute(tplRawBody, tplVars));
  }

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
      flashOk(autoDone ? "Notiz gespeichert + erledigt" : "Notiz gespeichert");
      setText("");
      if (autoDone) onActionCompleted?.();
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
      flashOk(
        autoDone ? "Outlook wird geöffnet + erledigt" : "Outlook wird geöffnet",
      );
      if (autoDone) onActionCompleted?.();
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

      {/* Template-Picker (Item 2.2 + 2.3) */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText size={11} className="text-muted-foreground/70" />
            <select
              value={selectedTplId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="flex-1 h-7 text-[11px] rounded-md bg-background border border-input px-2"
              title="Vorlage einfügen — Platzhalter werden unten ausfüllbar"
            >
              <option value="">— Vorlage einfügen —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tag ? `[${t.tag}] ` : ""}
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTplId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] text-muted-foreground hover:text-rose-600"
                onClick={() => applyTemplate("")}
                title="Vorlage zurücksetzen"
              >
                ✕
              </Button>
            )}
          </div>

          {placeholders.length > 0 && (
            <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
                  Platzhalter ({placeholders.length})
                </p>
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={applyVariables}
                  title="Variablen in den Text übernehmen"
                >
                  <Check size={11} /> Übernehmen
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {placeholders.map((name) => (
                  <div key={name} className="flex flex-col gap-0.5">
                    <label className="text-[9.5px] uppercase tracking-wider text-muted-foreground/80 font-medium">
                      {name}
                    </label>
                    <Input
                      value={tplVars[name] ?? ""}
                      onChange={(e) =>
                        setTplVars((prev) => ({
                          ...prev,
                          [name]: e.target.value,
                        }))
                      }
                      className="h-7 text-[12px]"
                      placeholder={`{{${name}}}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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

      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/40">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoDone}
            onChange={(e) => setAutoDone(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-emerald-500"
          />
          <span>Aufgabe nach Aktion auf <strong>erledigt</strong> setzen</span>
        </label>
        {onMarkControlling && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 gap-1 text-fuchsia-700 hover:bg-fuchsia-50 dark:text-fuchsia-300 dark:hover:bg-fuchsia-950/40"
            onClick={onMarkControlling}
            title="Status auf 'Controlling' setzen — Aufgabe wird nachverfolgt"
          >
            → Controlling
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
