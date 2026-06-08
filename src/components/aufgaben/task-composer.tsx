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
  Zap,
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
  /** Web-Link der Original-Mail (OWA). Für „Per Outlook antworten" (Web). */
  outlookWebLink?: string | null;
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
  outlookWebLink,
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
    "ai" | "note" | "mail" | "clip" | "hero-log" | "one-click" | null
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
  /** Entwurf-Indikator: zeigt "Entwurf gespeichert" kurz an. */
  const [draftSaved, setDraftSaved] = useState<boolean>(false);

  /** Entwurf-Persistenz: localStorage Key pro Task.
   *  Sowohl Mail-Antwort als auch Hero-Logbuch-Entwurf teilen sich das Feld
   *  (alternative Aktionen auf demselben Text). Ein Key reicht.
   *  Bei Hero-Tasks gibt's keine Persistenz (read-only Comments). */
  const draftKey = source === "mail" ? `draft:task:${taskId}:composer` : null;

  // 1) Beim Mount / Task-Wechsel: gespeicherten Entwurf laden
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved && saved.length > 0) {
        setText(saved);
      }
    } catch {
      // localStorage kann disabled sein (Private-Modus, Quotas) — ignorieren
    }
    // Nur beim Wechsel der draftKey laden, nicht bei jedem text-Change.
  }, [draftKey]);

  // 2) Beim Tippen: debounced als Entwurf speichern (500ms).
  //    WICHTIG: Bei Unmount / Task-Wechsel muss der pending Save SOFORT
  //    in localStorage geschrieben werden — sonst geht der Text verloren
  //    wenn der User zwischen Tippen und 500ms-Tick die Karte wechselt.
  useEffect(() => {
    if (!draftKey) return;
    // Leer-Text -> Eintrag loeschen (Cleanup)
    if (text.length === 0) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {}
      setDraftSaved(false);
      return;
    }
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, text);
        setDraftSaved(true);
        // Indikator nach 1.5s wieder ausblenden
        window.setTimeout(() => setDraftSaved(false), 1500);
      } catch {
        // Quota voll oder disabled — silent fail
      }
    }, 500);
    return () => {
      window.clearTimeout(handle);
      // Synchron flushen vor Unmount/Task-Wechsel — sonst geht Text verloren
      // bei schneller Task-Auswahl waehrend des 500ms-Debounce.
      try {
        window.localStorage.setItem(draftKey, text);
      } catch {}
    };
  }, [text, draftKey]);

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

  /** Kopiert text in die Zwischenablage — stille Fallback-Funktion. */
  async function clipboardWrite(body: string): Promise<boolean> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(body);
      } else {
        const ta = document.createElement("textarea");
        ta.value = body;
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function sendToHeroLog(bodyOverride?: string) {
    const body = (bodyOverride ?? text).trim();
    if (!body) {
      setError("Logbuch-Text ist leer");
      return;
    }
    if (!busy) setBusy("hero-log");
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
        // Fallback: Text in Zwischenablage + Hero-Logbuch öffnen
        const copied = await clipboardWrite(body);
        if (heroProjectHref) window.open(heroProjectHref, "_blank", "noopener,noreferrer");
        setError(
          `Hero API Fehler — ${copied ? "Text in Zwischenablage kopiert" : "Kopieren fehlgeschlagen"}${heroProjectHref ? " + Logbuch geöffnet" : ""}`,
        );
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
      // Netzwerkfehler: auch Fallback
      const copied = await clipboardWrite(body);
      if (heroProjectHref) window.open(heroProjectHref, "_blank", "noopener,noreferrer");
      setError(
        `Netzwerk-Fehler — ${copied ? "Text in Zwischenablage" : "Kopieren fehlgeschlagen"}${heroProjectHref ? " + Hero geöffnet" : ""}`,
      );
    } finally {
      setBusy(null);
    }
  }

  /** One-Click: KI-Entwurf generieren → Hero-Logbuch eintragen → Erledigt. */
  async function oneClickKiHeroDone() {
    setBusy("one-click");
    setError(null);
    // 1. KI-Entwurf generieren
    let draft = "";
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/ai-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint: hint.trim(), tone, mode: "hero_log" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `KI-Fehler ${res.status}`);
        setBusy(null);
        return;
      }
      draft = json.draft as string;
      setText(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "KI Netzwerk-Fehler");
      setBusy(null);
      return;
    }
    // 2. Hero-Logbuch eintragen (mit Fallback)
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/hero-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft, title: taskTitle || "KI-Notiz" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const copied = await clipboardWrite(draft);
        if (heroProjectHref) window.open(heroProjectHref, "_blank", "noopener,noreferrer");
        flashOk(`Hero Fehler — ${copied ? "in Zwischenablage + " : ""}Logbuch geöffnet`);
      } else {
        // Lokal archivieren
        await fetch(`/api/mail-tasks/${taskId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft, kind: "hero-log" }),
        }).catch(() => {});
        flashOk(`KI-Notiz ins Hero-Logbuch eingetragen + erledigt (Eintrag #${json.heroEntryId})`);
      }
      // 3. Aufgabe als erledigt markieren
      onActionCompleted?.();
    } catch {
      const copied = await clipboardWrite(draft);
      if (heroProjectHref) window.open(heroProjectHref, "_blank", "noopener,noreferrer");
      flashOk(`Netzwerk-Fehler — ${copied ? "Text kopiert + " : ""}Hero geöffnet`);
      onActionCompleted?.();
    } finally {
      setBusy(null);
    }
  }

  async function sendViaOutlook() {
    if (!outlookWebLink) {
      setError("Kein Outlook-Link verfügbar");
      return;
    }
    setBusy("mail");
    setError(null);
    try {
      const body = text.trim();
      if (body) {
        // Text in Zwischenablage legen, damit er in der OWA-Antwort eingefügt
        // werden kann, und als Notiz fuer die History speichern.
        await navigator.clipboard?.writeText(body).catch(() => {});
        await fetch(`/api/mail-tasks/${taskId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, kind: "mailto" }),
        }).catch(() => {});
      }
      // Ziel-URL immer auf Web-Outlook normalisieren (kein Desktop, kein
      // haengender cloud.microsoft-Deeplink).
      const h = outlookWebLink
        .replace(/outlook\.cloud\.microsoft/i, "outlook.office.com")
        .replace(/\/mail\/deeplink\/read\/[^?]+\?/i, "/owa/?");
      const webUrl = /viewmodel=/i.test(h) ? h : h + "&viewmodel=ReadMessageItem";
      window.open(webUrl, "_blank"); // immer im Browser
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

  /** Sofort-Variante: öffnet den nativen Mail-Client (Outlook Desktop / Mail)
   *  per mailto-Reply — kein Web-Boot, praktisch instant. */
  async function sendViaNative() {
    if (!mailto) {
      setError("Kein Absender — nativer Reply nicht möglich");
      return;
    }
    setError(null);
    try {
      const body = text.trim();
      const finalLink = body
        ? `${mailto}${mailto.includes("?") ? "&" : "?"}body=${encodeURIComponent(body)}`
        : mailto;
      if (body) {
        await fetch(`/api/mail-tasks/${taskId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, kind: "mailto" }),
        }).catch(() => {});
      }
      window.location.href = finalLink;
      if (autoDone) onActionCompleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Öffnen");
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
        {/* One-Click: KI + Hero + Erledigt — Haupt-CTA wenn Hero verknuepft.
         *  Generiert KI-Notiz, traegt sie ins Logbuch ein und markiert erledigt.
         *  Kein Text vorher noetig — Button schaltet bei leerem Feld aktiv. */}
        {heroProjectLinked && (
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm"
            onClick={oneClickKiHeroDone}
            disabled={busy !== null}
            title="KI-Notiz generieren + ins Hero-Logbuch eintragen + Aufgabe erledigen — alles in einem Klick"
          >
            {busy === "one-click" ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Läuft…
              </>
            ) : (
              <>
                <Zap size={12} /> KI + Hero + Erledigt
              </>
            )}
          </Button>
        )}

        {/* KI-Entwurf — generiert kontext-spezifischen Vorschlag
         *  basierend auf Email-Inhalt (Mail-Mode) oder Hero-Notification (Hero-Mode). */}
        <Button
          size="sm"
          variant={heroProjectLinked ? "outline" : "default"}
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

          {/* PRIMARY: Im Logbuch antworten — Haupt-Versand-Action wenn Hero verknuepft.
           *  Schreibt Text direkt ins Hero-Projekt-Logbuch via API.
           *  Bei Fehler: Clipboard-Fallback + Hero-Tab oeffnen (siehe sendToHeroLog). */}
          {heroProjectLinked && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm"
              onClick={() => void sendToHeroLog()}
              disabled={busy !== null || text.trim().length === 0}
              title="Schreibt den Text direkt ins Hero-Projekt-Logbuch (keine Mail noetig)"
            >
              {busy === "hero-log" ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Schreibt…
                </>
              ) : (
                <>
                  <Sparkles size={12} /> Im Logbuch antworten
                </>
              )}
            </Button>
          )}

          {/* Per Outlook antworten — bei Mail-Tasks immer sichtbar wenn Absender da ist.
           *  Bei Hero-verknuepften Tasks: Outline-Variante neben dem primaeren Logbuch-Button.
           *  Sonst: primaere Variante (Default-Style). */}
          {source === "mail" && outlookWebLink && (
            <Button
              size="sm"
              variant={heroProjectLinked ? "outline" : "default"}
              className="h-8 gap-1.5"
              onClick={sendViaOutlook}
              disabled={busy !== null}
              title="Öffnet die Mail im Web-Outlook zum Antworten (Text liegt in der Zwischenablage)"
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

          {/* Sofort-Variante: nativer Mail-Client (instant, kein Web-Boot). */}
          {source === "mail" && mailto && (
            <button
              type="button"
              onClick={sendViaNative}
              disabled={busy !== null}
              className="self-center text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
              title="Sofort im nativen Mail-Programm (Outlook Desktop / Mail) antworten — kein Web-Laden"
            >
              Desktop ↗
            </button>
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
        {draftSaved && (
          <span
            className="text-[10px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"
            title="Dein Entwurf wird automatisch lokal gespeichert. Beim naechsten Aufruf der Aufgabe ist er wieder da."
          >
            ● Entwurf gespeichert
          </span>
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
