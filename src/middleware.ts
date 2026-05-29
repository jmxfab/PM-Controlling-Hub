import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_AUTH_COOKIE,
  getDashboardPassword,
  isAuthCookieValid,
} from "@/lib/auth/dashboard-password";

/**
 * Pfade die nicht durch die Passwort-Schranke geschützt werden:
 * - /login (UI-Form)
 * - /api/auth/* (Login + Logout API)
 * - /api/cron/* (vom Vercel-Cron / GitHub-Actions per Bearer-Secret aufgerufen)
 * - statische Assets (_next/* etc.)
 */
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/cron"];
const PUBLIC_FILES = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_FILES.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Wenn kein Passwort konfiguriert ist:
  //   - Production: HART blocken (lieber 500 als oeffentliches Dashboard)
  //     — passiert nur wenn die Vercel-Env-Var versehentlich fehlt
  //   - Dev/Preview: Gate deaktivieren damit lokale Arbeit moeglich ist
  const password = getDashboardPassword();
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Dashboard ist nicht korrekt konfiguriert (DASHBOARD_PASSWORD fehlt).",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(DASHBOARD_AUTH_COOKIE)?.value ?? null;
  const valid = await isAuthCookieValid(cookie);
  if (valid) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const target = pathname + (search ?? "");
  if (target && target !== "/") {
    loginUrl.searchParams.set("next", target);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - api/health (optional: liveness probe ohne Auth)
     * - favicon.ico
     * - public/* assets
     *
     * Die feinere Whitelist (/login, /api/auth, /api/cron) erfolgt im
     * Middleware-Body, damit wir per-Pfad-Logik haben.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
