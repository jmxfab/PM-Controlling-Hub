import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 10;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/mail-tasks/[id]/link-hero-project
 *
 * Manuelles Mapping wenn AutoHeroMatch nichts gefunden hat.
 * Body: { projectNumber: string } — z.B. "9702", "EINS-9702", "PVS-9489"
 *
 * Strategie:
 *   1. Roh-Input normalisieren (Whitespace/Sonderzeichen weg)
 *   2. ILIKE-Search in hero_dashboard_projects nach project_number
 *   3. Genau 1 Treffer -> linken + persist
 *   4. 0 Treffer -> 404 mit Hinweis
 *   5. Mehrere Treffer -> 409 mit Kandidaten-Liste damit User waehlen kann
 *
 * Response (ok):    { matched: true, project: { id, number, name, customer } }
 * Response (none):  { matched: false, candidates: [] }
 * Response (multi): { matched: false, candidates: [...] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.startsWith("hero-")) {
    return NextResponse.json(
      { error: "ungueltige Task-ID" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    projectNumber?: string;
    projectId?: string;
  };

  // Direkte ID-Pfad: wenn User aus Kandidaten-Liste klickt, kommt projectId direkt.
  if (body.projectId) {
    const supabase = supabaseAdmin();
    const { data: p } = await supabase
      .from("hero_dashboard_projects")
      .select("id, project_number, project_name, customer_name")
      .eq("id", body.projectId)
      .maybeSingle();
    if (!p) {
      return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
    }
    await supabase
      .from("tasks")
      .update({
        hero_project_id: p.id,
        hero_project_number: p.project_number,
        hero_project_name: p.project_name,
        hero_match_attempted_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({
      matched: true,
      project: {
        id: p.id,
        number: p.project_number,
        name: p.project_name,
        customer: p.customer_name,
      },
    });
  }

  const raw = (body.projectNumber ?? "").trim();
  if (raw.length < 2) {
    return NextResponse.json(
      { error: "projectNumber zu kurz (min. 2 Zeichen)" },
      { status: 400 },
    );
  }

  // Normalisieren: Whitespace + Sonderzeichen die ILIKE brechen weg
  const cleaned = raw.replace(/[,()*%_\\]/g, " ").trim();
  if (!cleaned) {
    return NextResponse.json(
      { error: "projectNumber enthielt nur ungueltige Zeichen" },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();

  // Strategie A: nur Ziffern extrahieren ("EINS-9702" -> "9702") und suffix-match
  const digits = cleaned.replace(/\D/g, "");
  // Strategie B: kompletter String als Substring-Match
  const orClauses = [`project_number.ilike.%${cleaned}%`];
  if (digits.length >= 3 && digits !== cleaned) {
    orClauses.push(`project_number.ilike.%${digits}%`);
  }

  const { data: hits } = await supabase
    .from("hero_dashboard_projects")
    .select("id, project_number, project_name, customer_name")
    .or(orClauses.join(","))
    .limit(10);

  if (!hits || hits.length === 0) {
    return NextResponse.json(
      {
        matched: false,
        error: `Kein Hero-Projekt mit Nummer "${raw}" gefunden`,
        candidates: [],
      },
      { status: 404 },
    );
  }

  // Genau 1 Treffer -> direkt verlinken
  if (hits.length === 1) {
    const p = hits[0];
    await supabase
      .from("tasks")
      .update({
        hero_project_id: p.id,
        hero_project_number: p.project_number,
        hero_project_name: p.project_name,
        hero_match_attempted_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({
      matched: true,
      project: {
        id: p.id,
        number: p.project_number,
        name: p.project_name,
        customer: p.customer_name,
      },
    });
  }

  // Mehrere Treffer -> User soll waehlen. Frontend zeigt Kandidaten-Liste.
  return NextResponse.json(
    {
      matched: false,
      candidates: hits.map((h) => ({
        id: h.id,
        number: h.project_number,
        name: h.project_name,
        customer: h.customer_name,
      })),
    },
    { status: 409 },
  );
}
