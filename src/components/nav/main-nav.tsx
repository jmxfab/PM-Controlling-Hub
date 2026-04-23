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
          className="shrink-0 relative block self-center -mb-12 z-40 transition-transform hover:scale-[1.03]"
          aria-label="Jumax Controlling · Startseite"
        >
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
