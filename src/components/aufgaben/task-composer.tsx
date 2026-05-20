"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  ExternalLink,
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
  /** 'mail' = E-Mail-Aufgabe → Outlook-Reply als Hauptaktion.
   *  'hero' = Hero-Logbuch-Eintrag → KI generiert internen Notiztext,
   *  User kann kopieren oder direkt in Hero oeffnen. */
  source: "mail" | "hero";
  /** Bei „Per Outlook antworten" (nur source='mail'). Null wenn kein Sender. */
  mailto: string | null;
  /** Bei „In Hero oeffnen" (nur source='hero'). Deep-Link zum Projekt. */
  heroProjectHref?: string | null;
  /** Wenn gesetzt: aktiviert „Im Hero-Logbuch eintragen"-Button.
   *  Der Endpoint /api/mail-tasks/[id]/hero-log schreibt dann direkt
   *  per GraphQL-Mutation ins Hero-Projekt-Logbuch — keine Mail noetig. */
  heroProjectLinked?: boolean;
  /** Titel der Aufgabe — wird als 'custom_title' des Logbuch-Eintrags
   *  uebernommen wenn vorhanden. */
  taskTitle?: string;
  /** Auto-Done-Hook nach erfolgreicher Aktion. */
  onActionCompleted?: () => void;
  /** Status auf 'controlling' setzen. */
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
  source,
  mailto,
  heroProjectHref,
  heroProjectLinked,
  taskTitle,
  onActionCompleted,
  onMarkControlling,
}: Props) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [tone, setTone] = useState<ToneOpt>("freundlich");
  const [showHint, setShowHint] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [busy, setBusy] = useState<
    "ai" | "note" | "mail" | "clip" | "hero-log" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /** Wenn gesetzt, nach erfolgreichem Save/Send -> Task auf done. */
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
        body: JSON.stringify({
          hint: hint.trim(),
          tone,
          // Hero-Tasks: kompakte interne Notiz fuer Logbuch.
          // Mail-Tasks: voll formulierte Email-Antwort.
          // Hero-Tasks (source=hero) ODER Mail-Tasks mit Hero-Verknuepfung:
          // kurze interne Logbuch-Notiz statt langer Email-Antwort.
          mode: source === "hero" || heroProjectLinked ? "hero_log" : "email",
        }),
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

  async function copyToClipboard() {
    const body = text.trim();
    if (!body) {
      setError("Text ist leer");
      return;
    }
    setBusy("clip");
    setError(null);
    try {
      // Modern Clipboard API. Faellt auf execCommand zurueck wenn z.B.
      // iframe ohne permission. Mobile-Safari: HTTPS noetig.
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(body);
      } else {
        const ta = document.createElement("textarea");
        ta.value = body;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      // Als Notiz archivieren — kind 'hero-log' wenn fuer Hero gedacht
      await fetch(`/api/mail-tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          kind: source === "hero" ? "hero-log" : "note",
        }),
      }).catch(() => {});
      flashOk(
        source === "hero"
          ? autoDone
            ? "In Zwischenablage + erledigt"
            : "In Zwischenablage — jetzt in Hero einfügen"
          : "In Zwischenablage kopiert",
      );
      if (autoDone) onActionCompleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kopieren fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  async function sendToHeroLog() {
    const body = text.trim();
    if (!body) {
      setError("Logbuch-Text ist leer");
      return;
    }
    setBusy("hero-log");
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/hero-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: body,
          title: taskTitle || "Notiz aus Hub",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      // Notiz auch lokal als 'hero-log' kind speichern fuer History
      await fetch(`/api/mail-tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, kind: "hero-log" }),
      }).catch(() => {});
      flashOk(
        autoDone
          ? `Im Hero-Logbuch eingetragen + erledigt (Eintrag #${json.heroEntryId})`
          : `Im Hero-Logbuch eingetragen (Eintrag #${json.heroEntryId})`,
      );
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

      {/* Template-Picker (Item 2.2 + 2.3) — eingeklappt by default,
       *  KI-Kontext-Antwort ist Hauptweg. Templates fuer Standard-Faelle
       *  wie 'Zahlungserinnerung' wo der Wortlaut bewusst gleich sein soll. */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setShowTemplates((s) => !s)}
          >
            {showTemplates ? (
              <ChevronUp size={11} />
            ) : (
              <ChevronDown size={11} />
            )}
            <FileText size={11} />
            Vorlage einfügen {showTemplates ? "" : `(${templates.length})`}
          </Button>

          {showTemplates && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTplId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="flex-1 h-7 text-[11px] rounded-md bg-background border border-input px-2"
              title="Vorlage einfügen — Platzhalter werden unten ausfüllbar"
            >
              <option value="">— Vorlage wählen —</option>
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
          )}

          {showTemplates && placeholders.length > 0 && (
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
        {/* KI-Entwurf jetzt PRIMARY — generiert kontext-spezifischen Vorschlag
         *  basierend auf Email-Inhalt (Mail-Mode) oder Hero-Notification (Hero-Mode). */}
        <Button
          size="sm"
          variant="default"
          className="h-8 gap-1.5"
          onClick={generateAiDraft}
          disabled={busy !== null}
          title={
            source === "hero"
              ? "Claude schreibt einen kurzen internen Logbuch-Eintrag basierend auf dem Hero-Inhalt"
              : "Claude schreibt eine Antwort-Mail basierend auf dem Email-Inhalt"
          }
        >
          {busy === "ai" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> KI denkt…
            </>
          ) : (
            <>
              <Sparkles size={12} />
              {source === "hero" || heroProjectLinked ? "KI-Notiz" : "KI-Antwort"}
            </>
          )}
        </Button>

        {/* Hero-Logbuch — PRIMARY wenn Task an Hero-Projekt verknuepft.
         *  Steht direkt neben KI-Antwort weil das die haeufigste Aktion
         *  fuer Hero-Tasks ist (statt per Mail antworten -> direkt im Projekt). */}
        {heroProjectLinked && (
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={sendToHeroLog}
            disabled={busy !== null || text.trim().length === 0}
            title="Schreibt den Text direkt ins Hero-Projekt-Logbuch (keine Mail noetig)"
          >
            {busy === "hero-log" ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Schreibt…
              </>
            ) : (
              <>
                <Sparkles size={12} /> In Hero antworten
              </>
            )}
          </Button>
        )}

        {/* Sekundaer: Notiz in App speichern */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={saveNote}
          disabled={busy !== null || text.trim().length === 0}
          title="Als interne App-Notiz speichern"
        >
          {busy === "note" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Speichert…
            </>
          ) : (
            <>
              <Save size={12} /> Notiz
            </>
          )}
        </Button>

        {/* Versand-Block (kontext-abhaengig) — rechts ausgerichtet */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* In Zwischenablage — funktioniert immer, auch fuer Hero */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={copyToClipboard}
            disabled={busy !== null || text.trim().length === 0}
            title="Text in Zwischenablage kopieren — danach in Hero/Outlook/wo auch immer einfügen"
          >
            {busy === "clip" ? (
              <>
                <ClipboardCheck size={12} /> Kopiert
              </>
            ) : (
              <>
                <Clipboard size={12} /> In Zwischenablage
              </>
            )}
          </Button>

          {source === "hero" && heroProjectHref && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                // Optional: vorher in Zwischenablage kopieren damit der User
                // sofort einfuegen kann.
                if (text.trim().length > 0) {
                  void copyToClipboard();
                }
                window.open(heroProjectHref, "_blank", "noopener,noreferrer");
              }}
              disabled={busy !== null}
              title="Hero-Projekt in neuem Tab öffnen — Text ist in Zwischenablage, dort einfügen"
            >
              <ExternalLink size={12} /> In Hero öffnen
            </Button>
          )}

          {source === "mail" && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5"
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
          )}
        </div>

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
