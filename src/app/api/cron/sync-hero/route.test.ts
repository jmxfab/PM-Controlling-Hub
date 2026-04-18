// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

async function loadRouteHandlers() {
  return import("./route");
}

describe("/api/cron/sync-hero route", () => {
  it("rejects GET requests because sync is disabled in read-only mode", async () => {
    const { GET } = await loadRouteHandlers();
    const response = await GET(
      new NextRequest("https://example.com/api/cron/sync-hero")
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Read-only-Modus");
  });

  it("rejects POST requests because sync is disabled in read-only mode", async () => {
    const { POST } = await loadRouteHandlers();
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Read-only-Modus");
  });
});
