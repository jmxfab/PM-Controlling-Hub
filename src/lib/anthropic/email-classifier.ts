import Anthropic from "@anthropic-ai/sdk";

export type EmailCategory = "info" | "aufgabe" | "dringend";

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
- aufgabe: Konkrete Handlung oder Rückmeldung erforderlich
- dringend: Zeitkritisch, sofortiger Handlungsbedarf`;

const USER_PROMPT_TEMPLATE = `Analysiere diese E-Mail und antworte NUR als JSON:

{
  "category": "info" | "aufgabe" | "dringend",
  "title": "Kurzer Aufgabentitel (max 60 Zeichen)",
  "summary": "2-3 Sätze Zusammenfassung",
  "due_date": "YYYY-MM-DD oder null",
  "reasoning": "Kurze Begründung der Kategorie (1 Satz)"
}

E-Mail:
Von: {sender_name} <{sender_email}>
Betreff: {subject}
Inhalt:
{body}`;

export async function classifyEmail(params: {
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
}): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }

  const client = new Anthropic({ apiKey });

  const userPrompt = USER_PROMPT_TEMPLATE.replace("{sender_name}", params.senderName)
    .replace("{sender_email}", params.senderEmail)
    .replace("{subject}", params.subject)
    .replace("{body}", params.body.slice(0, 4000));

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  const result = JSON.parse(text) as ClassificationResult;

  if (!["info", "aufgabe", "dringend"].includes(result.category)) {
    result.category = "info";
  }

  return result;
}
