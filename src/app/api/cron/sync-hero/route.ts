import { NextRequest, NextResponse } from "next/server";
import { fetchAllHeroProjects } from "@/lib/hero/hero-client";
import {
  groupProjectsByDepartment,
  computeKPIsFromProjects,
} from "@/lib/hero/hero-aggregator";
import { upsertKpiSnapshot } from "@/lib/supabase/dashboard-queries";

/**
 * POST /api/cron/sync-hero
 *
 * Called daily at 06:00 by Vercel Cron (see vercel.json)
 * or manually via the "Jetzt synchronisieren" button in the Dashboard.
 *
 * Fetches all projects from Hero, aggregates KPIs per department,
 * and upserts today's snapshot into Supabase.
 */
export async function POST(request: NextRequest) {
  // Protect against unauthorized manual calls in production
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (
    expectedSecret &&
    cronSecret !== expectedSecret &&
    process.env.NODE_ENV === "production"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // 1. Fetch all projects from Hero
    const projects = await fetchAllHeroProjects();

    // 2. Group by department (PV, WP, HAUSTECHNIK) + GESAMT
    const grouped = groupProjectsByDepartment(projects);

    // 3. Compute KPIs and upsert into Supabase for each department
    const departments = ["GESAMT", "PV", "WP", "HAUSTECHNIK"] as const;
    const results: Record<string, number> = {};

    for (const dept of departments) {
      const kpis = computeKPIsFromProjects(grouped[dept]);
      await upsertKpiSnapshot(dept, kpis);
      results[dept] = grouped[dept].length;
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Hero sync completed",
      totalProjects: projects.length,
      projectsByDepartment: results,
      durationMs: duration,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[sync-hero] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also allow GET for Vercel Cron jobs (they use GET by default)
export async function GET(request: NextRequest) {
  return POST(request);
}
