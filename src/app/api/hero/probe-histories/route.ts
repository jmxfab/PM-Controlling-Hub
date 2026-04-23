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
      histories(first: 2, orderBy: "id") {
        id
        created
        modified
        type
        target_project_match_id
        user_id
        user { id name email username login }
        target_id
        message
        log
        entry
        body
        value
        data
        action
        changes
        old_value
        new_value
        field_name
        field
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
