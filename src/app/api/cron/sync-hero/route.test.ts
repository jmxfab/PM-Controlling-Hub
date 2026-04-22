// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/hero-sync", () => ({
  runHeroSync: vi.fn(),
}));

async function loadRouteHandlers() {
  return import("./route");
}

describe("/api/cron/sync-hero route", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when CRON_SECRET is set and token is missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { GET } = await loadRouteHandlers();
    const response = await GET(
      new NextRequest("https://example.com/api/cron/sync-hero")
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is set and token is wrong", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { GET } = await loadRouteHandlers();
    const response = await GET(
      new NextRequest("https://example.com/api/cron/sync-hero", {
        headers: { authorization: "Bearer wrong-token" },
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns 200 with sync result when runHeroSync succeeds", async () => {
    const { runHeroSync } = await import("@/lib/services/hero-sync");
    vi.mocked(runHeroSync).mockResolvedValue({
      totalProjects: 42,
      projectsByDepartment: { PV: 10, WP: 20, HAUSTECHNIK: 12, GESAMT: 42 },
      durationMs: 1200,
      syncedAt: "2026-04-22T04:00:00.000Z",
    });

    const { GET } = await loadRouteHandlers();
    const response = await GET(
      new NextRequest("https://example.com/api/cron/sync-hero")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.totalProjects).toBe(42);
  });

  it("returns 500 with error message when runHeroSync throws", async () => {
    const { runHeroSync } = await import("@/lib/services/hero-sync");
    vi.mocked(runHeroSync).mockRejectedValue(new Error("Hero API nicht erreichbar"));

    const { GET } = await loadRouteHandlers();
    const response = await GET(
      new NextRequest("https://example.com/api/cron/sync-hero")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Hero API nicht erreichbar");
  });
});
