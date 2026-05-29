import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createNotionTask } from "@/lib/notion/notion-client";

const bodySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, title, summary } = parsed.data;
  const supabase = getSupabaseAdmin();

  // Atomares CAS: nur wenn status noch NICHT 'pushed_to_notion' → verhindert
  // Race Conditions bei gleichzeitigen Requests.
  const { data: claimed, error: claimError } = await supabase
    .from("emails_processed")
    .update({ status: "pushing" })
    .eq("id", id)
    .neq("status", "pushed_to_notion")
    .neq("status", "pushing")
    .select("*")
    .single();

  if (claimError || !claimed) {
    const { data: existing } = await supabase
      .from("emails_processed")
      .select("status")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Bereits in Notion eingetragen" }, { status: 409 });
  }

  let notionPageId: string;
  try {
    notionPageId = await createNotionTask({
      title,
      subject: claimed.subject ?? "(kein Betreff)",
      senderEmail: claimed.sender_email ?? "",
      category: claimed.category,
      summary,
      receivedAt: claimed.received_at ?? claimed.created_at,
      dueDate: claimed.extracted_due_date ?? null,
    });
  } catch (err) {
    // Rollback claim so the user can retry
    await supabase
      .from("emails_processed")
      .update({ status: "pending" })
      .eq("id", id);
    throw err;
  }

  const { error: finalizeError } = await supabase
    .from("emails_processed")
    .update({ status: "pushed_to_notion", notion_page_id: notionPageId })
    .eq("id", id);

  if (finalizeError) {
    console.error("push-to-notion: failed to finalize status", finalizeError.message);
  }

  return NextResponse.json({ success: true, notion_page_id: notionPageId });
}
