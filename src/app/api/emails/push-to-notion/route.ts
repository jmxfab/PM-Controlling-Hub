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

  const { data: email, error } = await supabase
    .from("emails_processed")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !email) {
    return NextResponse.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  if (email.status === "pushed_to_notion") {
    return NextResponse.json({ error: "Bereits in Notion eingetragen" }, { status: 409 });
  }

  const notionPageId = await createNotionTask({
    title,
    subject: email.subject ?? "(kein Betreff)",
    senderEmail: email.sender_email ?? "",
    category: email.category,
    summary,
    receivedAt: email.received_at ?? email.created_at,
    dueDate: email.extracted_due_date ?? null,
  });

  await supabase
    .from("emails_processed")
    .update({ status: "pushed_to_notion", notion_page_id: notionPageId })
    .eq("id", id);

  return NextResponse.json({ success: true, notion_page_id: notionPageId });
}
