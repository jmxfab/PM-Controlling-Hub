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

const navItems = [
  { href: "/", label: "Controlling", icon: LayoutDashboard },
  { href: "/faelligkeiten", label: "Fälligkeiten", icon: CalendarClock },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/cash", label: "Cash", icon: Euro },
  // /deckungsbeitrag ausgeblendet bis die Datenbasis (Materialkosten /
  // Stundenerfassung) Deckungsbeitrags-Berechnungen trägt.
  { href: "/emails", label: "E-Mails", icon: Mail },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-visible z-30">
      <div className="max-w-[1200px] mx-auto px-8 h-16 flex items-center gap-6 overflow-visible">
        <Link
          href="/"
          className="shrink-0 relative self-end translate-y-4 z-40"
          aria-label="Jumax Controlling · Startseite"
        >
          {/* Logo ragt bewusst über die Unterkante des Headers hinaus. */}
          <Image
            src="/jumax-logo.png"
            alt="Jumax Logo"
            width={88}
            height={88}
            priority
            className="rounded-lg drop-shadow-lg"
          />
        </Link>
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
