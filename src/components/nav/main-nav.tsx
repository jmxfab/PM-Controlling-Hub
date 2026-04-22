"use client";

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

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/faelligkeiten", label: "Fälligkeiten", icon: CalendarClock },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/cashflow", label: "Cashflow", icon: Euro },
  // /deckungsbeitrag ausgeblendet bis die Datenbasis (Materialkosten /
  // Stundenerfassung) Deckungsbeitrags-Berechnungen trägt.
  { href: "/emails", label: "E-Mails", icon: Mail },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-[1200px] mx-auto px-8 h-14 flex items-center gap-6">
        <span className="font-semibold text-sm">JMX Controlling</span>
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
      </div>
    </header>
  );
}
