import { NextRequest, NextResponse } from "next/server";
import { fetchUnreadEmails } from "@/lib/ms-graph/ms-graph-client";
import { classifyEmail } from "@/lib/anthropic/email-classifier";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const results = { processed: 0, skipped: 0, errors: 0 };

  let emails;
  try {
    emails = await fetchUnreadEmails(30);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Graph API Fehler: ${message}` }, { status: 500 });
  }

  for (const email of emails) {
    try {
      const { data: existing } = await supabase
        .from("emails_processed")
        .select("id")
        .eq("message_id", email.id)
        .maybeSingle();

      if (existing) {
        results.skipped++;
        continue;
      }

      const bodyText =
        email.body?.contentType === "html"
          ? email.body.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
          : (email.body?.content ?? email.bodyPreview ?? "");

      const classification = await classifyEmail({
        senderName: email.from?.emailAddress.name ?? "",
        senderEmail: email.from?.emailAddress.address ?? "",
        subject: email.subject ?? "(kein Betreff)",
        body: bodyText,
      });

      await supabase.from("emails_processed").insert({
        message_id: email.id,
        subject: email.subject,
        sender_email: email.from?.emailAddress.address ?? null,
        sender_name: email.from?.emailAddress.name ?? null,
        received_at: email.receivedDateTime,
        body_preview: email.bodyPreview,
        full_body: bodyText.slice(0, 10000),
        category: classification.category,
        extracted_title: classification.title,
        extracted_summary: classification.summary,
        extracted_due_date: classification.due_date,
        status: "pending",
      });

      results.processed++;
    } catch (err) {
      console.error(`Fehler bei E-Mail ${email.id}:`, err);
      results.errors++;
    }
  }

  return NextResponse.json({ success: true, ...results });
}
