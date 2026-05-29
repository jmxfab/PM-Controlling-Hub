import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 10;
// Server-Component-Friendly: max 5 Min Cache, dann fresh.
export const revalidate = 300;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * GET /api/admin/db-size
 * Liefert Supabase-DB-Size-Stats fuer den Insights-Header.
 * Wird vom DB-Size-Card im Insights-Dashboard genutzt.
 */
export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .rpc("compute_db_size_stats")
      .single<{
        total_bytes: number;
        table_count: number;
        largest_tables: Array<{ name: string; bytes: number }>;
      }>();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "no data" },
        { status: 500 },
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
