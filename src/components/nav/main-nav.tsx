"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarClock,
  Euro,
  ListTodo,
  LogOut,
  Newspaper,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Primäre Tabs — links im Header, in Lese-Reihenfolge. Einstellungen
 * ist bewusst NICHT hier, sondern rechts als Zahnrad.
 *
 * /  (Controlling) ist aus dem Nav ausgeblendet — wird gerade nicht genutzt.
 * Seite ist via Logo-Klick + direkter URL noch erreichbar.
 */
const navItems: NavItem[] = [
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/cash", label: "Cash", icon: Euro },
  { href: "/faelligkeiten", label: "Geplant", icon: CalendarClock },
  { href: "/aufgaben", label: "Aufgaben", icon: ListTodo },
  { href: "/logbuch", label: "Logbuch", icon: BookOpen },
  // /projekte (Pulse) und /digest temporaer ausgeblendet — Pages
  // existieren noch und sind ueber direkte URL erreichbar.
];

export function MainNav() {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/einstellungen");

  // Login-Seite läuft außerhalb der App-Schale (kein Header, kein Logo).
  if (pathname.startsWith("/login")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      {/* Razor-thin brand accent line — sits on the bottom border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent dark:via-blue-400/30"
      />
      <div className="relative max-w-[1600px] mx-auto pl-2 pr-4 h-20 flex items-center gap-4">
        {/* Logo + Wordmark */}
        <Link
          href="/"
          className="group shrink-0 flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-95"
          aria-label="Jumax Controlling · Startseite"
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/30 to-violet-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
            <Image
              src="/jumax-logo.png"
              alt="Jumax Logo"
              width={72}
              height={72}
              priority
              className="relative block"
            />
          </div>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight">
              Controlling Hub
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
              Jumax Elektrotechnik
            </span>
          </div>
        </Link>

        {/* Primary nav */}
        <nav className="flex items-center gap-0.5 flex-1 ml-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm transition-all duration-200 ${
                  active
                    ? "bg-foreground text-background font-semibold shadow-[0_4px_14px_-2px_hsl(var(--foreground)/0.25)] dark:shadow-[0_4px_14px_-2px_hsl(var(--foreground)/0.4)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon
                  size={15}
                  className={`transition-transform duration-200 ${
                    active ? "" : "group-hover:scale-110 group-hover:-rotate-3"
                  }`}
                />
                <span>{label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side: Settings + Logout */}
        <div className="shrink-0 flex items-center gap-1">
          <Link
            href="/einstellungen"
            aria-label="Einstellungen"
            title="Einstellungen"
            className={`group flex items-center justify-center h-9 w-9 rounded-lg transition-all ${
              settingsActive
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Settings
              size={17}
              className="transition-transform group-hover:rotate-45 duration-300"
            />
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

function LogoutButton() {
  async function handleClick() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Abmelden"
      title="Abmelden"
      className="group flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all"
    >
      <LogOut
        size={17}
        className="transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
