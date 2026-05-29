import { NextRequest, NextResponse } from "next/server";
import { loadWeeklyDigest } from "@/lib/digest/weekly-digest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/weekly-digest
 *
 * Wird von Vercel-Cron jeden Montag 7:30 Berlin (= 5:30 UTC Winter / 6:30 UTC
 * Sommer — vercel.json nutzt UTC) gerufen. Wenn ein Auth-Token in der Env
 * gesetzt ist, validieren wir das (vom Vercel-Cron-Header), sonst offen
 * (passiert nur in Dev/Preview).
 *
 * Ablauf:
 *   1. Digest-Daten laden
 *   2. Wenn RESEND_API_KEY + DIGEST_RECIPIENT_EMAIL gesetzt: Mail versenden
 *   3. Sonst: nur loggen + JSON-Response (Cron-Status checken)
 */
export async function GET(req: NextRequest) {
  // Vercel-Cron sendet 'Authorization: Bearer <CRON_SECRET>'
  // Wenn wir den setzen, nur den lassen wir durch. Sonst offen (für Tests).
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const digest = await loadWeeklyDigest();

    const recipient = process.env.DIGEST_RECIPIENT_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;

    let sent = false;
    let mailError: string | null = null;
    if (recipient && resendKey) {
      try {
        const html = renderDigestHtml(digest);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:
              process.env.DIGEST_FROM_EMAIL ??
              "Controlling Hub <onboarding@resend.dev>",
            to: [recipient],
            subject: `Wochen-Digest · ${digest.rangeLabel}`,
            html,
          }),
        });
        if (res.ok) {
          sent = true;
        } else {
          const errBody = await res.text().catch(() => "");
          mailError = `Resend ${res.status}: ${errBody.slice(0, 200)}`;
        }
      } catch (e) {
        mailError = e instanceof Error ? e.message : String(e);
      }
    }

    return NextResponse.json({
      ok: true,
      rangeLabel: digest.rangeLabel,
      sentEmail: sent,
      mailError,
      stats: {
        topPeople: digest.topPeople.length,
        anomalies: digest.anomalies.length,
        newProjects: digest.newProjects.length,
        completedProjects: digest.completedProjects.length,
        tasks: digest.tasks,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** Plain-HTML Email-Body. Bewusst simpel — keine externen Bilder, kein CSS-Tricks. */
function renderDigestHtml(
  digest: Awaited<ReturnType<typeof loadWeeklyDigest>>,
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const fmtEur = (n: number) =>
    new Intl.NumberFormat("de-AT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  const peopleRows = digest.topPeople
    .map(
      (p, i) =>
        `<tr><td style="padding:4px 8px;color:#888">#${i + 1}</td><td style="padding:4px 8px">${esc(p.name ?? p.email)}</td><td style="padding:4px 8px;text-align:right;font-weight:600">${p.events}</td></tr>`,
    )
    .join("");

  const anomalyRows = digest.anomalies
    .slice(0, 5)
    .map(
      (a) =>
        `<tr><td style="padding:4px 8px">${esc(a.name ?? a.email)}</td><td style="padding:4px 8px;color:#888;text-align:right">${a.thisWeek} / ⌀${a.avg4Weeks}</td><td style="padding:4px 8px;text-align:right;color:${a.deltaPct < -50 ? "#dc2626" : "#d97706"}">${a.deltaPct}%</td></tr>`,
    )
    .join("");

  const projectsNew = digest.newProjects
    .slice(0, 5)
    .map(
      (p) =>
        `<li>${esc(p.number ?? "—")} · ${esc(p.customer ?? p.name ?? "—")}</li>`,
    )
    .join("");

  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:0 auto;padding:16px">
    <h1 style="margin:0 0 4px;font-size:22px">Wochen-Digest</h1>
    <p style="margin:0 0 24px;color:#666;font-size:14px">${esc(digest.rangeLabel)}</p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:24px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px"><div style="font-size:11px;color:#666;text-transform:uppercase">Neue Aufgaben</div><div style="font-size:24px;font-weight:700">${digest.tasks.newCount}</div></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px"><div style="font-size:11px;color:#666;text-transform:uppercase">Erledigt</div><div style="font-size:24px;font-weight:700">${digest.tasks.doneCount}</div></div>
      <div style="border:1px solid #fecaca;border-radius:8px;padding:12px"><div style="font-size:11px;color:#dc2626;text-transform:uppercase">Kritisch offen</div><div style="font-size:24px;font-weight:700;color:#dc2626">${digest.tasks.kritischOpen}</div></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px"><div style="font-size:11px;color:#666;text-transform:uppercase">Offen gesamt</div><div style="font-size:24px;font-weight:700">${digest.tasks.openTotal}</div></div>
    </div>

    <h2 style="font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;margin:24px 0 8px">Top Mitarbeiter</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">${peopleRows || '<tr><td style="color:#999;font-style:italic">Keine Events.</td></tr>'}</table>

    ${
      digest.anomalies.length > 0
        ? `<h2 style="font-size:14px;text-transform:uppercase;color:#d97706;letter-spacing:0.05em;margin:24px 0 8px">Anomalien (Krankheits-/Urlaubs-Indikator)</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">${anomalyRows}</table>`
        : ""
    }

    <h2 style="font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;margin:24px 0 8px">Liquidität</h2>
    <p style="margin:4px 0;font-size:14px">Offen gesamt: <strong>${fmtEur(digest.cash.totalOpenEur)}</strong></p>
    <p style="margin:4px 0;font-size:14px;color:${digest.cash.overdueEur > 0 ? "#dc2626" : "#111"}">Überfällig: <strong>${fmtEur(digest.cash.overdueEur)}</strong> (${digest.cash.overdueCount} Rechnungen)</p>

    ${
      projectsNew
        ? `<h2 style="font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;margin:24px 0 8px">Neue Projekte</h2><ul style="font-size:13px;margin:8px 0;padding-left:20px">${projectsNew}</ul>`
        : ""
    }

    <p style="margin-top:32px;font-size:11px;color:#999">Generiert von JMX Controlling Hub · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://jumax-controlling-hub.vercel.app"}/digest" style="color:#2563eb">Im Browser ansehen</a></p>
  </body></html>`;
}
