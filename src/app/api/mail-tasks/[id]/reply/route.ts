import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Ruft einen frischen Access-Token aus der gespeicherten n8n OAuth2-Credential ab,
 * indem es den Refresh-Token gegen das Microsoft Token-Endpoint tauscht.
 *
 * Erwartet folgende Env-Variablen im Controlling-Hub-Deploy:
 * - MS_TENANT_ID       — Azure Tenant
 * - MS_CLIENT_ID       — Azure App Client ID (n8n-mail-reader)
 * - MS_CLIENT_SECRET   — Azure App Client Secret
 * - MS_REFRESH_TOKEN   — Refresh-Token aus dem n8n-Connect-Flow (einmalig einkopieren)
 */
async function getAccessToken(): Promise<string> {
  const tenant = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const refreshToken = process.env.MS_REFRESH_TOKEN;
  if (!tenant || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Microsoft Graph Reply nicht konfiguriert: MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET / MS_REFRESH_TOKEN fehlen",
    );
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/Mail.Send offline_access",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Token-Refresh fehlgeschlagen: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { message?: string };
    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Body fehlt (Feld 'message')" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("source_email_id, title")
      .eq("id", id)
      .maybeSingle();

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    if (!task) return NextResponse.json({ error: "Task nicht gefunden" }, { status: 404 });
    if (!task.source_email_id) {
      return NextResponse.json(
        {
          error:
            "Keine Original-Email-ID hinterlegt — diese Task wurde vor dem Reply-Feature erstellt. Auf neue Mails kann geantwortet werden.",
        },
        { status: 400 },
      );
    }

    const accessToken = await getAccessToken();

    // Microsoft Graph Reply Endpoint — fuegt antwort an die Original-Mail.
    // Reply-To-All wuerde "replyAll" sein. Hier "reply" = nur an Sender.
    const replyRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(task.source_email_id)}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: message,
        }),
      },
    );

    if (!replyRes.ok) {
      const text = await replyRes.text();
      return NextResponse.json({ error: `Graph reply failed: ${replyRes.status} ${text}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id, sent: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
