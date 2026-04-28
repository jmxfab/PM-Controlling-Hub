"use client";

import { useState } from "react";
import { Bell, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Cog,
  Hammer,
  Play,
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
  | "closingsScheduled"
  | "appointmentsCompleted"
  | "appointmentsWorked"
  | "appointmentsAdded";

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

const ACTIVITY_KPIS: KpiDef[] = [
  {
    key: "appointmentsCompleted",
    title: "Termine abgeschlossen",
    description: "Gesamtmontage / Kleinauftrag, is_done=true",
    icon: CheckCircle2,
  },
  {
    key: "appointmentsWorked",
    title: "Termine bearbeitet",
    description: "Termin im Zeitraum stattgefunden",
    icon: Play,
  },
  {
    key: "appointmentsAdded",
    title: "Termine neu hinzugekommen",
    description: "im Zeitraum frisch angelegt",
    icon: CalendarPlus,
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
      case "appointmentsCompleted":
        return kpis.appointmentActivity.completed.count;
      case "appointmentsWorked":
        return kpis.appointmentActivity.worked.count;
      case "appointmentsAdded":
        return kpis.appointmentActivity.added.count;
    }
  }

  return (
    <>
      <div className="space-y-4">
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

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
            Termin-Aktivität · Gesamtmontage / Kleinauftrag
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {ACTIVITY_KPIS.map((def) => {
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
  const def = selected
    ? [...KPIS, ...ACTIVITY_KPIS].find((d) => d.key === selected) ?? null
    : null;

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
                selected === "meterChange" ||
                selected === "appointmentsCompleted" ||
                selected === "appointmentsWorked" ||
                selected === "appointmentsAdded" ? (
                <EventsTable
                  events={
                    selected === "installations"
                      ? kpis.installations.events
                      : selected === "storageWallbox"
                        ? kpis.storageWallbox.events
                        : selected === "meterChange"
                          ? kpis.meterChange.events
                          : selected === "appointmentsCompleted"
                            ? kpis.appointmentActivity.completed.events
                            : selected === "appointmentsWorked"
                              ? kpis.appointmentActivity.worked.events
                              : kpis.appointmentActivity.added.events
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
          <TableHead className="w-56">Erinnerung</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e) => (
          <EventTableRow
            key={e.id}
            event={e}
            buildHref={buildHref}
            heroProjectLinkTemplate={heroProjectLinkTemplate}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function EventTableRow({
  event,
  buildHref,
  heroProjectLinkTemplate,
}: {
  event: PvKpiCalendarEvent;
  buildHref: (id: string | null) => string | null;
  heroProjectLinkTemplate: string | null;
}) {
  const href = buildHref(event.projectId);
  const initialDate = event.reminderAt
    ? event.reminderAt.slice(0, 10)
    : "";
  const [reminderDate, setReminderDate] = useState(initialDate);
  const [reminderNote, setReminderNote] = useState(event.reminderNote ?? "");
  const [savedDate, setSavedDate] = useState(initialDate);
  const [savedNote, setSavedNote] = useState(event.reminderNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = reminderDate !== savedDate || reminderNote !== savedNote;
  const reminderInPast =
    savedDate &&
    new Date(`${savedDate}T23:59:59`).getTime() <= Date.now();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar-events/${event.id}/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_at: reminderDate || null,
          reminder_note: reminderNote || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
        return;
      }
      setSavedDate(reminderDate);
      setSavedNote(reminderNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="text-xs tabular-nums whitespace-nowrap">
        {event.start
          ? new Date(event.start).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "–"}
      </TableCell>
      <TableCell className="text-sm">
        {event.projectId ? (
          <HeroProjectLink
            projectId={event.projectId}
            projectNumber={event.projectNumber}
            linkTemplate={heroProjectLinkTemplate}
          />
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
        {event.projectName ? (
          <span className="block text-xs text-muted-foreground">
            {event.projectName}
          </span>
        ) : null}
      </TableCell>
      <TableCell className="text-sm">
        <span>{event.title ?? "–"}</span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[10px] text-primary hover:underline"
          >
            Im Hero öffnen →
          </a>
        ) : null}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {event.category ?? "–"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={reminderDate}
              onChange={(ev) => setReminderDate(ev.target.value)}
              className="h-7 w-[130px] text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!dirty || saving}
              onClick={save}
              title="Speichern"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            type="text"
            placeholder="Notiz (optional)"
            value={reminderNote}
            onChange={(ev) => setReminderNote(ev.target.value)}
            className="h-7 text-xs"
            maxLength={500}
          />
          {savedDate && !dirty ? (
            <Badge
              variant="outline"
              className={
                reminderInPast
                  ? "self-start gap-1 border-red-500/50 text-red-500"
                  : "self-start gap-1 border-amber-500/50 text-amber-600"
              }
            >
              <Bell className="h-3 w-3" />
              {new Date(savedDate).toLocaleDateString("de-DE")}
            </Badge>
          ) : null}
          {error ? (
            <span className="text-[10px] text-destructive">{error}</span>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
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
