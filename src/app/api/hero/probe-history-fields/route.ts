import { NextResponse } from "next/server";
import { heroGraphQL } from "@/lib/hero/hero-client";

export async function GET() {
  // Full sample with all confirmed fields
  const sample = await heroGraphQL<{ notifications: unknown[] }>(
    `query ProbeNotifications($first: Int!, $offset: Int!) {
      notifications(first: $first, offset: $offset, orderBy: "id") {
        id
        created
        modified
        title
        body
        is_read
        target_id
        user_id
      }
    }`,
    { first: 30, offset: 0 }
  ).catch((e: unknown) => ({ error: String(e) }));

  // Count total
  const count = await heroGraphQL<{ notifications: { id: number }[] }>(
    `query CountNotifications($first: Int!, $offset: Int!) {
      notifications(first: $first, offset: $offset, orderBy: "id") { id }
    }`,
    { first: 500, offset: 0 }
  ).catch(() => null);

  return NextResponse.json({
    sample,
    totalFetched: Array.isArray((count as { notifications?: unknown[] })?.notifications)
      ? (count as { notifications: unknown[] }).notifications.length
      : "unknown",
  });
}
