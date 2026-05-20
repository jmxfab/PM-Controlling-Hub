import { z } from "zod";
import { callClaudeMessage } from "@/lib/anthropic/client";

export type EmailCategory = "info" | "aufgabe" | "dringend" | "pl_aufgabe" | "gf_aufgabe";

export interface ClassificationResult {
  category: EmailCategory;
  title: string;
  summary: string;
  due_date: string | null;
  reasoning: string;
}

const SYSTEM_PROMPT = `Du bist ein E-Mail-Assistent für ein Elektrotechnik-Unternehmen (Jumax).
Analysiere eingehende E-Mails und klassifiziere sie. Antworte NUR als gültiges JSON-Objekt ohne Markdown.

Kategorien:
- info: Newsletter, Informationen, keine Aktion erforderlich
- aufgabe: Konkrete Handlung erforderlich (allgemein)
- dringend: Zeitkritisch, sofortiger Handlungsbedarf
- pl_aufgabe: Aufgabe für den PROJEKTLEITER — Terminplanung, Baustellenkoordination, technische Rückfragen von Kunden/Lieferanten, Materialbestellungen/-lieferungen, Abnahmen, Mängelrügen, Bauzeitverlängerungen, Subunternehmer-Koordination
- gf_aufgabe: Aufgabe für die GESCHÄFTSFÜHRUNG — Angebotsprüfung/-freigabe, Auftragsbestätigung, Finanzentscheidungen (Budgetfreigabe, Großeinkauf, Zahlungsmodalitäten), Eskalationen von Kunden/Behörden, strategische Anfragen, VIP-Kunden oder Schlüsselkunden, rechtliche/behördliche Post

WICHTIG — Summary-Stil:
- KEINEN Aufsatz schreiben. Maximal EIN kurzer Satz, der die KERN-Info enthält.
- Wenn die Mail von Hero (Hero-Software, hero@, noreply@hero) kommt: NUR den Original-Betreff sinngemäß in 1 Zeile zusammenfassen. KEINE Vermutungen, KEINE Erklärungen.
- Bei Newsletter/Bestätigungen (info-Kategorie): summary darf LEER ("") sein.
- Keine Floskeln wie "Diese E-Mail informiert über..." oder "Der Absender bittet darum...". Direkt zum Punkt.`;

const USER_PROMPT_TEMPLATE = `Analysiere diese E-Mail und antworte NUR als JSON:

{
  "category": "info" | "aufgabe" | "dringend" | "pl_aufgabe" | "gf_aufgabe",
  "title": "Kurzer Aufgabentitel (max 60 Zeichen)",
  "summary": "MAX 1 Satz, knapp. Leer-String '' wenn nichts hinzuzufuegen.",
  "due_date": "YYYY-MM-DD oder null",
  "reasoning": "Kurze Begründung der Kategorie (1 Satz)"
}

E-Mail:
Von: {sender_name} <{sender_email}>
Betreff: {subject}
Inhalt:
{body}`;

/** Detect Hero-Notification-Mails (Hero-Software-Notifications, Logbuch-Mails).
 *  Erkennung per Absender-Email, Absender-Name ODER Betreff-Muster.
 *  Solche Mails brauchen keinen KI-Aufsatz — Betreff alleine reicht. */
function isHeroNotification(
  senderEmail: string,
  senderName: string,
  subject: string,
): boolean {
  const e = senderEmail.toLowerCase();
  const n = senderName.toLowerCase();
  const s = subject.toLowerCase();
  // Absender-basiert
  if (/(^|[@.+_-])hero([@.+_-]|$)/.test(e)) return true;
  if (/noreply.*hero|hero.*noreply/.test(e)) return true;
  if (n.includes("hero") && (n.includes("benachrichtigung") || n.includes("notification"))) {
    return true;
  }
  // Betreff-basiert: Hero sendet Mails mit diesen Mustern fuer Projekt-Aktivitaeten
  if (/kommentar zum projekt|neuer kommentar|neue aufgabe.*hero|hero.*aufgabe/.test(s)) return true;
  // Muster wie "PVS-1234: Neuer Kommentar" oder "[Hero] ..."
  if (/^\[hero\]/i.test(subject)) return true;
  return false;
}

export async function classifyEmail(params: {
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
}): Promise<ClassificationResult> {
  // Fast-Path fuer Hero-Notifications: kein langer Aufsatz, Betreff = Title
  if (isHeroNotification(params.senderEmail, params.senderName, params.subject)) {
    return {
      category: "info",
      title: params.subject.slice(0, 120) || "Hero-Benachrichtigung",
      summary: "",
      due_date: null,
      reasoning: "Hero-System-Benachrichtigung (Auto-erkannt, kein KI-Lauf)",
    };
  }

  const userPrompt = USER_PROMPT_TEMPLATE.replace("{sender_name}", params.senderName)
    .replace("{sender_email}", params.senderEmail)
    .replace("{subject}", params.subject)
    .replace("{body}", params.body.slice(0, 4000));

  const raw = await callClaudeMessage({
    prompt: userPrompt,
    system: SYSTEM_PROMPT,
    model: "claude-haiku-4-5-20251001",
    maxTokens: 512,
  });

  // Strip optional markdown fences Claude sometimes wraps around JSON
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Email classifier returned non-JSON response: ${text.slice(0, 200)}`);
  }

  const schema = z.object({
    category: z.enum(["info", "aufgabe", "dringend", "pl_aufgabe", "gf_aufgabe"]).catch("info"),
    title: z.string().max(120).catch("(kein Titel)"),
    summary: z.string().max(2000).catch(""),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .catch(null),
    reasoning: z.string().max(500).catch(""),
  });

  const result = schema.parse(parsed);

  // Post-Processing: Summary auf max. 1 Satz / 200 Zeichen kappen,
  // damit der Classifier nicht doch wieder Aufsaetze schreibt.
  const trimmedSummary = trimToOneSentence(result.summary);

  return { ...result, summary: trimmedSummary } as ClassificationResult;
}

/** Schneidet einen Text auf maximal einen Satz und 200 Zeichen,
 *  entfernt Floskeln am Anfang. */
function trimToOneSentence(s: string): string {
  if (!s) return "";
  let t = s.trim();
  // Floskeln am Anfang entfernen
  t = t.replace(
    /^(Diese E-Mail|Die E-Mail|Der Absender|Diese Mail|In dieser Mail|Die Mail)\s+[^.]*\.\s*/i,
    "",
  );
  // Bis zum ersten Satzende kuerzen
  const m = t.match(/^[^.!?]*[.!?]/);
  if (m) t = m[0];
  // Hartes Limit
  if (t.length > 200) t = t.slice(0, 197).trimEnd() + "…";
  return t.trim();
}
