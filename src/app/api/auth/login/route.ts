import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DASHBOARD_AUTH_COOKIE,
  DASHBOARD_AUTH_MAX_AGE_SECONDS,
  computePasswordToken,
  getDashboardPassword,
} from "@/lib/auth/dashboard-password";

export const runtime = "nodejs";

const bodySchema = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const expectedPassword = getDashboardPassword();
  if (!expectedPassword) {
    // Schutz nicht konfiguriert → trotzdem grünes Licht, damit ein
    // versehentliches Aufrufen von /login nicht in einer Endlosschleife
    // landet.
    return NextResponse.json({ ok: true, protectionDisabled: true });
  }

  const ok = constantTimeStringEquals(parsed.data.password, expectedPassword);
  if (!ok) {
    return NextResponse.json(
      { error: "Falsches Passwort." },
      { status: 401 }
    );
  }

  const token = await computePasswordToken(expectedPassword);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DASHBOARD_AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DASHBOARD_AUTH_MAX_AGE_SECONDS,
  });
  return response;
}

function constantTimeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
