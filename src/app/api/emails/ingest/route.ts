import { NextRequest, NextResponse } from "next/server";
import { classifyEmail } from "@/lib/anthropic/email-classifier";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * E-Mail-Ingest-Endpunkt für n8n.
 *
 * n8n liest die Mails aus Microsoft (Outlook-Node) und POSTet sie hierher.
 * Die App dedupliziert über `message_id`, klassifiziert (sofern n8n keine
 * fertige Klassifizierung mitschickt) und schreibt in `emails_processed`.
 * Von dort erscheinen die Mails automatisch in der Aufgaben-/Mail-Ansicht.
 *
 * Schutz: Header `Authorization: Bearer <INGEST_SECRET>`.
 *
 * Erwartetes Body-Format (Array oder { emails: [...] }):
 *   {
 *     "emails": [
 *       {
 *         "message_id": "AAMk...",          // Pflicht (Graph message id)
 *         "subject": "Betreff",
 *         "sender_email": "kunde@example.de",
 *         "sender_name": "Max Mustermann",
 *         "received_at": "2026-05-29T08:00:00Z",
 *         "body": "<html>...</html>",        // oder reiner Text
 *         "body_preview": "Kurzvorschau...",
 *         // optional: bereits in n8n klassifiziert -> App überspringt Claude
 *         "classification": {
 *           "category": "aufgabe",
 *           "title": "...",
 *           "summary": "...",
 *           "due_date": "2026-06-01"
 *         }
 *       }
 *     ]
 *   }
 */

interface IncomingEmail {
  message_id?: string;
  id?: string;
  subject?: string | null;
  sender_email?: string | null;
  sender_name?: string | null;
  received_at?: string | null;
  body?: string | null;
  body_html?: string | null;
  body_preview?: string | null;
  classification?: {
    category?: string;
    title?: string;
    summary?: string;
    due_date?: string | null;
  } | null;
}

function htmlToText(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: INGEST_SECRET is not set" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emails: IncomingEmail[] = Array.isArray(payload)
    ? (payload as IncomingEmail[])
    : Array.isArray((payload as { emails?: unknown })?.emails)
      ? ((payload as { emails: IncomingEmail[] }).emails)
      : [payload as IncomingEmail];

  const supabase = getSupabaseAdmin();
  const results = { processed: 0, skipped: 0, errors: 0 };
  const errorDetails: string[] = [];

  for (const email of emails) {
    const messageId = email.message_id ?? email.id;
    if (!messageId) {
      results.errors++;
      errorDetails.push("Eintrag ohne message_id übersprungen");
      continue;
    }

    try {
      const { data: existing } = await supabase
        .from("emails_processed")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existing) {
        results.skipped++;
        continue;
      }

      const rawBody = email.body ?? email.body_html ?? "";
      const looksHtml = /<[a-z][\s\S]*>/i.test(rawBody);
      const bodyText = looksHtml ? htmlToText(rawBody) : rawBody.trim();
      const subject = email.subject ?? "(kein Betreff)";

      // Klassifizierung: bevorzugt das was n8n mitschickt, sonst Claude in der App.
      const classification =
        email.classification?.category
          ? {
              category: email.classification.category,
              title: email.classification.title ?? subject.slice(0, 120),
              summary: email.classification.summary ?? "",
              due_date: email.classification.due_date ?? null,
            }
          : await classifyEmail({
              senderName: email.sender_name ?? "",
              senderEmail: email.sender_email ?? "",
              subject,
              body: bodyText,
            });

      const { error: insertError } = await supabase.from("emails_processed").insert({
        message_id: messageId,
        subject: email.subject ?? subject,
        sender_email: email.sender_email ?? null,
        sender_name: email.sender_name ?? null,
        received_at: email.received_at ?? new Date().toISOString(),
        body_preview: email.body_preview ?? bodyText.slice(0, 280),
        full_body: bodyText.slice(0, 10000),
        category: classification.category,
        extracted_title: classification.title,
        extracted_summary: classification.summary,
        extracted_due_date: classification.due_date,
        status: "pending",
      });

      if (insertError) {
        // Race-Condition: parallel eingefügt -> als skip werten statt Fehler
        if (insertError.code === "23505") {
          results.skipped++;
          continue;
        }
        throw new Error(insertError.message);
      }

      results.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Ingest-Fehler bei Mail ${messageId}:`, message);
      results.errors++;
      errorDetails.push(`${messageId}: ${message}`);
    }
  }

  return NextResponse.json({
    success: results.errors === 0,
    ...results,
    ...(errorDetails.length > 0 ? { errors_detail: errorDetails.slice(0, 10) } : {}),
  });
}
