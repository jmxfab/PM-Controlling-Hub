"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
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
  { href: "/logbuch", label: "Logbuch", icon: BookOpen },
];

export function MainNav() {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/einstellungen");

  return (
    <header className="relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-30">
      <div className="relative max-w-[1400px] mx-auto pl-1 pr-4 h-24 flex items-center gap-6">
        <Link
          href="/"
          className="shrink-0 block"
          aria-label="Jumax Controlling · Startseite"
        >
          {/* Logo 96×96, passt komplett in die h-24-Header — kein Overlap
              mit dem Seiteninhalt, keine Umrandung, kein Hover-Effekt. */}
          <Image
            src="/jumax-logo.png"
            alt="Jumax Logo"
            width={96}
            height={96}
            priority
            className="block"
          />
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
