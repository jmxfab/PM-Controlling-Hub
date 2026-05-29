import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_TAGS = new Set([
  "hero_dashboard_projects",
  "insights",
  "cash",
  "historic",
]);

/**
 * Cache-Invalidation-Endpoint für den Sync-Workflow.
 * Muss mit dem geheimen Token in `CACHE_REVALIDATE_SECRET` aufgerufen werden.
 * GitHub Actions ruft das nach erfolgreichem Refresh der Materialized Views.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CACHE_REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CACHE_REVALIDATE_SECRET not configured" },
      { status: 500 }
    );
  }

  const provided =
    request.headers.get("x-revalidate-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request
    .json()
    .catch(() => ({}))) as { tags?: string[] };
  const requested =
    Array.isArray(payload.tags) && payload.tags.length > 0
      ? payload.tags.filter((t: string) => KNOWN_TAGS.has(t))
      : Array.from(KNOWN_TAGS);

  for (const tag of requested) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ ok: true, revalidated: requested });
}
