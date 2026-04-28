"use client";

import { useState } from "react";
import {
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cog,
  Hammer,
  Receipt,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { HeroProjectLink } from "./hero-project-link";
import type {
  PvControllingKpis,
  PvKpiCalendarEvent,
  PvKpiProject,
} from "@/lib/supabase/hero-pv-kpis";

type KpiKey =
  | "pipelineActive"
  | "invoicesSent"
  | "installations"
  | "storageWallbox"
  | "reworkResolved"
  | "meterChange"
  | "reworkScheduled"
  | "reworkUnscheduled"
  | "closingsToPlan"
  | "closingsScheduled";

interface KpiDef {
  key: KpiKey;
  title: string;
  description: string;
  icon: LucideIcon;
}

const KPIS: KpiDef[] = [
  {
    key: "pipelineActive",
    title: "Aktive Projekte",
    description: "Montageplanung bis Abschlussgespräch planen",
    icon: Briefcase,
  },
  {
    key: "invoicesSent",
    title: "Rechnungen versendet",
    description: "diese Jumax-Woche · status_code=200, exkl. Storno",
    icon: Receipt,
  },
  {
    key: "installations",
    title: "Gesamtmontagen",
    description: "Termine: Gesamtmontage / AC / DC — diese Jumax-Woche",
    icon: Hammer,
  },
  {
    key: "storageWallbox",
    title: "WB / Speichererweiterung",
    description: "Termin-Titel: Wallbox / WB / Speicher — diese Woche",
    icon: Cog,
  },
  {
    key: "reworkResolved",
    title: "Nacharbeiten erledigt",
    description: "Status raus aus Nacharbeit-Step — diese Woche",
    icon: CheckCircle2,
  },
  {
    key: "meterChange",
    title: "Zählerwechsel",
    description: "Termin-Titel: Zählerwechsel / Zählermontage — diese Woche",
    icon: Zap,
  },
  {
    key: "reworkScheduled",
    title: "Nacharbeiten terminiert",
    description: "offen mit gesetztem Termin",
    icon: CalendarClock,
  },
  {
    key: "reworkUnscheduled",
    title: "Nacharbeiten nicht terminiert",
    description: "offen ohne Termin",
    icon: Wrench,
  },
  {
    key: "closingsToPlan",
    title: "Abschlussgespräche zu planen",
    description: "Step: ➡️ Abschlussgespräch planen",
    icon: ClipboardList,
  },
  {
    key: "closingsScheduled",
    title: "Geplante Abschlussgespräche",
    description: "Step: 🤝 Abschlussgespräch + Termin gesetzt",
    icon: CalendarCheck,
  },
];

interface PvControllingKpisProps {
  kpis: PvControllingKpis;
  windowLabel: string;
  heroProjectLinkTemplate: string | null;
}

export function PvControllingKpis({
  kpis,
  windowLabel,
  heroProjectLinkTemplate,
}: PvControllingKpisProps) {
  const [selected, setSelected] = useState<KpiKey | null>(null);

  function valueFor(key: KpiKey): number {
    switch (key) {
      case "pipelineActive":
        return kpis.pipelineActive.count;
      case "invoicesSent":
        return kpis.invoicesSent.count;
      case "installations":
        return kpis.installations.count;
      case "storageWallbox":
        return kpis.storageWallbox.count;
      case "reworkResolved":
        return kpis.reworkResolved.count;
      case "meterChange":
        return kpis.meterChange.count;
      case "reworkScheduled":
        return kpis.reworkScheduled.count;
      case "reworkUnscheduled":
        return kpis.reworkUnscheduled.count;
      case "closingsToPlan":
        return kpis.closingsToPlan.count;
      case "closingsScheduled":
        return kpis.closingsScheduled.count;
    }
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
          PV-Controlling · {windowLabel}
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {KPIS.map((def) => {
            const Icon = def.icon;
            const value = valueFor(def.key);
            return (
              <button
                key={def.key}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setSelected(def.key)}
                className="group h-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className={cn("h-full transition-colors group-hover:border-ring/40 group-hover:bg-accent/20")}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {def.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tabular-nums">
                      {value}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {def.description}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      <PvKpiDetailDialog
        selected={selected}
        onClose={() => setSelected(null)}
        kpis={kpis}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
      />
    </>
  );
}

function PvKpiDetailDialog({
  selected,
  onClose,
  kpis,
  heroProjectLinkTemplate,
}: {
  selected: KpiKey | null;
  onClose: () => void;
  kpis: PvControllingKpis;
  heroProjectLinkTemplate: string | null;
}) {
  const def = selected ? KPIS.find((d) => d.key === selected) ?? null : null;

  function buildHref(projectId: string | null): string | null {
    if (!heroProjectLinkTemplate || !projectId) return null;
    return heroProjectLinkTemplate.replace("{projectId}", projectId);
  }

  return (
    <Dialog open={selected !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {def ? (
          <>
            <DialogHeader>
              <DialogTitle>{def.title}</DialogTitle>
              <DialogDescription>{def.description}</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto -mx-6 px-6">
              {selected === "invoicesSent" ? (
                <InvoicesTable
                  items={kpis.invoicesSent.items}
                  buildHref={buildHref}
                  heroProjectLinkTemplate={heroProjectLinkTemplate}
                />
              ) : selected === "installations" ||
                selected === "storageWallbox" ||
                selected === "meterChange" ? (
                <EventsTable
                  events={
                    selected === "installations"
                      ? kpis.installations.events
                      : selected === "storageWallbox"
                        ? kpis.storageWallbox.events
                        : kpis.meterChange.events
                  }
                  buildHref={buildHref}
                  heroProjectLinkTemplate={heroProjectLinkTemplate}
                />
              ) : (
                <ProjectsTable
                  projects={
                    selected === "pipelineActive"
                      ? kpis.pipelineActive.projects
                      : selected === "reworkResolved"
                        ? kpis.reworkResolved.projects
                        : selected === "reworkScheduled"
                          ? kpis.reworkScheduled.projects
                          : selected === "reworkUnscheduled"
                            ? kpis.reworkUnscheduled.projects
                            : selected === "closingsToPlan"
                              ? kpis.closingsToPlan.projects
                              : kpis.closingsScheduled.projects
                  }
                  buildHref={buildHref}
                  heroProjectLinkTemplate={heroProjectLinkTemplate}
                />
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProjectsTable({
  projects,
  buildHref,
  heroProjectLinkTemplate,
}: {
  projects: PvKpiProject[];
  buildHref: (id: string | null) => string | null;
  heroProjectLinkTemplate: string | null;
}) {
  if (projects.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground text-center italic">
        Keine Projekte.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Projekt-Nr.</TableHead>
          <TableHead>Titel / Kunde</TableHead>
          <TableHead>Step</TableHead>
          <TableHead>Fällig</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => {
          const href = buildHref(p.id);
          return (
            <TableRow
              key={p.id}
              className={href ? "cursor-pointer hover:bg-accent/40" : undefined}
              onClick={
                href
                  ? () =>
                      window.open(href, "_blank", "noopener,noreferrer")
                  : undefined
              }
            >
              <TableCell>
                <HeroProjectLink
                  projectId={p.id}
                  projectNumber={p.projectNumber}
                  linkTemplate={heroProjectLinkTemplate}
                />
              </TableCell>
              <TableCell className="text-sm">
                {p.projectName ?? p.customerName ?? "–"}
                {p.customerName &&
                p.customerName !== p.projectName ? (
                  <span className="block text-xs text-muted-foreground">
                    {p.customerName}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{p.stepName ?? "–"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {p.maturityDate
                  ? new Date(p.maturityDate).toLocaleDateString("de-DE")
                  : "–"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function EventsTable({
  events,
  buildHref,
  heroProjectLinkTemplate,
}: {
  events: PvKpiCalendarEvent[];
  buildHref: (id: string | null) => string | null;
  heroProjectLinkTemplate: string | null;
}) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground text-center italic">
        Keine Termine.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead>Projekt</TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>Kategorie</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e) => {
          const href = buildHref(e.projectId);
          return (
            <TableRow
              key={e.id}
              className={href ? "cursor-pointer hover:bg-accent/40" : undefined}
              onClick={
                href
                  ? () =>
                      window.open(href, "_blank", "noopener,noreferrer")
                  : undefined
              }
            >
              <TableCell className="text-xs tabular-nums whitespace-nowrap">
                {e.start
                  ? new Date(e.start).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "–"}
              </TableCell>
              <TableCell className="text-sm">
                {e.projectId ? (
                  <HeroProjectLink
                    projectId={e.projectId}
                    projectNumber={e.projectNumber}
                    linkTemplate={heroProjectLinkTemplate}
                  />
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
                {e.projectName ? (
                  <span className="block text-xs text-muted-foreground">
                    {e.projectName}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{e.title ?? "–"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {e.category ?? "–"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function InvoicesTable({
  items,
  buildHref,
  heroProjectLinkTemplate,
}: {
  items: Array<{
    id: string;
    projectNumber: string | null;
    projectName: string | null;
    customerName: string | null;
    docNumber: string | null;
    type: string | null;
    created: string | null;
  }>;
  buildHref: (id: string | null) => string | null;
  heroProjectLinkTemplate: string | null;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground text-center italic">
        Keine Rechnungen.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rechnungs-Nr.</TableHead>
          <TableHead>Projekt</TableHead>
          <TableHead>Kunde</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Datum</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((it) => {
          const href = buildHref(null); // no project_id passed through here
          return (
            <TableRow key={it.id} className={href ? "cursor-pointer hover:bg-accent/40" : undefined}>
              <TableCell className="font-mono text-xs">
                {it.docNumber ?? it.id}
              </TableCell>
              <TableCell className="text-sm">
                <HeroProjectLink
                  projectId={null}
                  projectNumber={it.projectNumber}
                  linkTemplate={heroProjectLinkTemplate}
                />
                {it.projectName ? (
                  <span className="block text-xs text-muted-foreground">
                    {it.projectName}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {it.customerName ?? "–"}
              </TableCell>
              <TableCell className="text-sm">{it.type ?? "–"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {it.created
                  ? new Date(it.created).toLocaleDateString("de-DE")
                  : "–"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
