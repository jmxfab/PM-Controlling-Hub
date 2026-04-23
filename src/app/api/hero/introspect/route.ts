import { NextRequest, NextResponse } from "next/server";
import { introspectHeroSchema } from "@/lib/hero/hero-client";

/**
 * GET /api/hero/introspect
 *
 * One-time helper: Queries the Hero GraphQL schema to discover available fields.
 * Call this once to understand what data Hero actually provides.
 * Remove or protect this endpoint after initial discovery.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  try {
    const schema = await introspectHeroSchema();
    return NextResponse.json(schema, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
