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

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

/** Hero-ID akzeptieren auch wenn sie im Frontend mit "hero-" Prefix kommt. */
function normalizeHeroId(raw: string): string {
  return raw.startsWith("hero-") ? raw.slice(5) : raw;
}

/** Markiert eine Hero-Notification als gelesen (lokaler Override) */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      hero_id?: string;
    };
    if (!body.hero_id || typeof body.hero_id !== "string") {
      return NextResponse.json({ error: "hero_id required" }, { status: 400 });
    }
    const hero_id = normalizeHeroId(body.hero_id);

    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("hero_read_overrides")
      .upsert({ hero_id, read_at: new Date().toISOString() });
    if (error) {
      return NextResponse.json({ error: errMsg(error) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, hero_id });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

/** Markiert eine Hero-Notification wieder als ungelesen (Override entfernen) */
export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      hero_id?: string;
    };
    if (!body.hero_id || typeof body.hero_id !== "string") {
      return NextResponse.json({ error: "hero_id required" }, { status: 400 });
    }
    const hero_id = normalizeHeroId(body.hero_id);

    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("hero_read_overrides")
      .delete()
      .eq("hero_id", hero_id);
    if (error) {
      return NextResponse.json({ error: errMsg(error) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, hero_id });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
