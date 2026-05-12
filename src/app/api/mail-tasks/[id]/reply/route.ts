import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Ruft einen n8n-Webhook auf, der via Microsoft Graph eine Reply an die
 * Original-Mail sendet. n8n haelt den OAuth-Token von Domenic, wir hier
 * sehen den nie. Sicherheit via HMAC-Signatur (SHA256) + Timestamp.
 *
 * Erwartet folgende Env-Variablen im Controlling-Hub-Deploy:
 * - N8N_REPLY_WEBHOOK_URL     z.B. https://n8n-eree.srv1603751.hstgr.cloud/webhook/mail-reply
 * - N8N_REPLY_WEBHOOK_SECRET  Shared Secret (>= 32 chars), gleicher Wert
 *                             muss in n8n als $env.REPLY_WEBHOOK_SECRET vorliegen
 */
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

    const webhookUrl = process.env.N8N_REPLY_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_REPLY_WEBHOOK_SECRET;
    if (!webhookUrl || !webhookSecret) {
      return NextResponse.json(
        {
          error:
            "Reply nicht konfiguriert: N8N_REPLY_WEBHOOK_URL / N8N_REPLY_WEBHOOK_SECRET fehlen in der Vercel-Env",
        },
        { status: 500 },
      );
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

    // HMAC-signiertes Payload: ts.JSON(body) -> SHA256(secret)
    const payload = { email_id: task.source_email_id, message };
    const ts = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(payload);
    const signed = `${ts}.${bodyStr}`;
    const signature = crypto.createHmac("sha256", webhookSecret).update(signed).digest("hex");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-jmx-timestamp": ts,
        "x-jmx-signature": signature,
      },
      body: bodyStr,
    });

    const respJson = await res.json().catch(() => ({}));
    if (!res.ok || respJson.ok === false) {
      return NextResponse.json(
        {
          error: `n8n-Webhook fehlgeschlagen: ${res.status} ${respJson.reason ?? respJson.error ?? "(no detail)"}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, id, sent: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
