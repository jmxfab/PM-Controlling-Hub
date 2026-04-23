"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  Euro,
  LayoutDashboard,
  Mail,
  Settings,
} from "lucide-react";

/**
 * Primäre Tabs — links im Header, in Lese-Reihenfolge. Einstellungen
 * ist bewusst NICHT hier, sondern rechts als Zahnrad.
 */
const navItems = [
  { href: "/", label: "Controlling", icon: LayoutDashboard },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/cash", label: "Cash", icon: Euro },
  { href: "/faelligkeiten", label: "Geplant", icon: CalendarClock },
  // /deckungsbeitrag ausgeblendet bis die Datenbasis (Materialkosten /
  // Stundenerfassung) Deckungsbeitrags-Berechnungen trägt.
  { href: "/emails", label: "E-Mails", icon: Mail },
];

export function MainNav() {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/einstellungen");

  return (
    <header className="relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-visible z-30">
      <div className="relative max-w-[1400px] mx-auto pl-3 pr-4 h-16 flex items-center gap-6 overflow-visible">
        <Link
          href="/"
          className="group shrink-0 relative block self-center translate-y-8 z-40"
          aria-label="Jumax Controlling · Startseite"
        >
          {/* Größeres Logo (140×140) hängt bewusst über die Header-Unterkante.
              Eigene dunkle Fläche mit sanftem Schatten + leichtem Ring für
              saubere Kante gegenüber dem Page-Background, ohne "Sticker"-
              Eindruck. Auf Hover leicht anheben. */}
          <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
            <Image
              src="/jumax-logo.png"
              alt="Jumax Logo"
              width={140}
              height={140}
              priority
              className="block"
            />
          </div>
        </Link>
        <nav className="flex items-center gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/einstellungen"
          aria-label="Einstellungen"
          title="Einstellungen"
          className={`shrink-0 ml-auto flex items-center justify-center h-9 w-9 rounded-md transition-colors ${
            settingsActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}
