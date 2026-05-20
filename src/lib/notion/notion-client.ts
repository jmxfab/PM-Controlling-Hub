import { Client } from "@notionhq/client";
import type { EmailCategory } from "@/lib/anthropic/email-classifier";

interface CreateNotionTaskParams {
  title: string;
  subject: string;
  senderEmail: string;
  category: EmailCategory;
  summary: string;
  receivedAt: string;
  dueDate: string | null;
}

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  info: "Info",
  aufgabe: "Todo",
  dringend: "Dringend",
  pl_aufgabe: "PL",
  gf_aufgabe: "GF",
};

function getNotionClient(): Client {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY ist nicht gesetzt.");
  }
  return new Client({ auth: apiKey });
}

export async function createNotionTask(params: CreateNotionTaskParams): Promise<string> {
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_TASKS_DATABASE_ID ist nicht gesetzt.");
  }

  const notion = getNotionClient();

  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: params.title } }],
    },
    Betreff: {
      rich_text: [{ text: { content: params.subject } }],
    },
    Absender: {
      email: params.senderEmail,
    },
    Priorität: {
      select: { name: CATEGORY_LABELS[params.category] },
    },
    Status: {
      select: { name: "Offen" },
    },
    Zusammenfassung: {
      rich_text: [{ text: { content: params.summary } }],
    },
    Empfangen: {
      date: { start: params.receivedAt },
    },
  };

  if (params.dueDate) {
    properties["Fälligkeitsdatum"] = {
      date: { start: params.dueDate },
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
  });

  return page.id;
}
