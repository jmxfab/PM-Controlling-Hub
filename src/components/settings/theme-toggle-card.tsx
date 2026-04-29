"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const OPTIONS = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggleCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // SSR-Hydration-Guard: theme ist serverseitig nicht bekannt, deshalb
  // erst nach Mount auf den echten Wert wechseln.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const active = mounted ? theme ?? "system" : "system";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Darstellung</CardTitle>
        <CardDescription>
          Farbschema des Dashboards. {`„System“`} folgt den Einstellungen deines
          Betriebssystems.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex rounded-md border p-1 bg-muted/30">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = active === value;
            return (
              <Button
                key={value}
                variant={selected ? "default" : "ghost"}
                size="sm"
                className="gap-2"
                onClick={() => setTheme(value)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
