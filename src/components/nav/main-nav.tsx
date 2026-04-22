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
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/faelligkeiten", label: "Fälligkeiten", icon: CalendarClock },
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
      <div className="relative max-w-[1200px] mx-auto pl-16 pr-8 h-16 flex items-center gap-6 overflow-visible">
        <Link
          href="/"
          className="group shrink-0 relative block self-center -mb-12 z-40 transition-transform hover:scale-[1.03]"
          aria-label="Jumax Controlling · Startseite"
        >
          {/* Logo (96×96) hängt unter die Header-Unterkante.
              Kein rounded/shadow — die schwarze PNG-Fläche geht sauber in
              den Page-Background über (Light + Dark). */}
          <Image
            src="/jumax-logo.png"
            alt="Jumax Logo"
            width={96}
            height={96}
            priority
            className="block"
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
