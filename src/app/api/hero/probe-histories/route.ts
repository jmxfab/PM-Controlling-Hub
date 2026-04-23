import { NextResponse } from "next/server";
import { heroGraphQL } from "@/lib/hero/hero-client";

/**
 * GET /api/hero/probe-histories
 *
 * Temporary endpoint to discover the actual field names of Hero's History type.
 * Queries with all likely field names; Hero's error messages include "Did you mean"
 * hints that reveal the real field names. Remove after discovery.
 */
export async function GET() {
  const query = `
    query ProbeHistories {
      histories(first: 1, orderBy: "id") {
        id
        created
        modified
        text
        note
        description
        content
        project_match_id
        project_match { id }
        partner_id
        partner { id first_name last_name }
        user_id
        user { id first_name last_name }
        type
        category
        subject
        title
      }
    }
  `;

  try {
    const data = await heroGraphQL<unknown>(query);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 200 }
    );
  }
}
