import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Production-Optimierungen
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Aggressives Tree-Shaking fuer grosse Packages — schneidet ungenutzte
  // Module beim Build raus, dramatisch kleineres Client-Bundle.
  // lucide-react allein hat ~1000 Icons — wir nutzen vielleicht 40.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@radix-ui/react-tabs",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-checkbox",
      "date-fns",
    ],
    // Client-Side Router-Cache: gerenderte Pages im Browser-Memory laenger halten,
    // damit Navigation Cash -> Insights -> Cash kein Re-Fetch ausloest.
    // - static: 5 min (revalidate-Pages = Cash/Insights/Geplant/Logbuch)
    // - dynamic: 1 min (Pages ohne revalidate / mit cookies/etc)
    // Hard-Refresh (Cmd+R) holt sowieso frische Daten — der Cache greift nur
    // bei Navigation via Next.js Link.
    staleTimes: {
      static: 300,
      dynamic: 60,
    },
  },
  async redirects() {
    return [
      // /cashflow → /cash (Rename 2026-04-22)
      {
        source: "/cashflow",
        destination: "/cash",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
