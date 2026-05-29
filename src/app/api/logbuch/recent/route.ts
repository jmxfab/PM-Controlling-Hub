import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { loadLogbuchPage } from "@/lib/supabase/hero-logbuch-queries";

export const runtime = "nodejs";
export const maxDuration = 10;

const querySchema = z.object({
  project_id: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(3),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    project_id: searchParams.get("project_id") ?? "",
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  try {
    const page = await loadLogbuchPage(
      { projectId: parsed.data.project_id },
      0,
      parsed.data.limit
    );
    return NextResponse.json({ entries: page.entries, total: page.total });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
