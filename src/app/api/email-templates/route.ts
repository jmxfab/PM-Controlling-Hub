import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 10;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  body: string;
  tag: string | null;
  sort_order: number;
}

/**
 * GET /api/email-templates
 * Liefert alle aktiven Templates fuer den Composer-Picker.
 */
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("email_templates")
    .select("id, name, description, subject, body, tag, sort_order")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { templates: (data ?? []) as EmailTemplate[] },
    {
      headers: {
        // Templates aendern sich selten — cache aggressiv
        "Cache-Control":
          "private, max-age=300, stale-while-revalidate=600",
      },
    },
  );
}
