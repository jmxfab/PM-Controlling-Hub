import { NextResponse, type NextRequest } from "next/server";

/**
 * Einfacher HTTP-Basic-Auth-Schutz für das gesamte Dashboard.
 *
 * Credentials kommen aus DASHBOARD_PASSWORD (Default: "controlling").
 * Benutzername: frei wählbar, wird NICHT geprüft (ein gemeinsames Passwort
 * für alle Jumax-Mitarbeiter — kein User-Management nötig).
 *
 * Ausgenommen:
 *  - Static Assets (_next/static, _next/image, favicon, public/*)
 *  - Vercel-Cron-Routen (/api/cron/*) — laufen ohne Browser und haben
 *    eigene Secrets via Bearer-Token.
 *
 * Passwort ändern: in Vercel env `DASHBOARD_PASSWORD` setzen, redeploy.
 */

const EXCLUDED_PREFIXES = [
  "/_next/static",
  "/_next/image",
  "/favicon",
  "/api/cron",
  "/public",
];

function isExcluded(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isExcluded(pathname)) return NextResponse.next();

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return new NextResponse("Server misconfigured: DASHBOARD_PASSWORD is not set", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const header = req.headers.get("authorization") ?? "";

  if (header.startsWith("Basic ")) {
    const encoded = header.slice("Basic ".length).trim();
    try {
      // atob is available in Next.js middleware (Edge runtime) and in Node.
      const decoded =
        typeof atob === "function"
          ? atob(encoded)
          : Buffer.from(encoded, "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      const password = separator >= 0 ? decoded.slice(separator + 1) : decoded;
      if (password === expected) return NextResponse.next();
    } catch {
      // Fallthrough → 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="JMX Controlling", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|api/cron).*)"],
};
