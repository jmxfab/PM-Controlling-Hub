"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Flame,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { HeizlastProject } from "@/lib/supabase/hero-heizlast-queries";

interface Props {
  projects: HeizlastProject[];
  heroProjectLinkTemplate: string | null;
}

/** Bereinigt Hero-Projektnamen wie "-7558 | --, --, --" → "-7558" */
function cleanProjectName(name: string | null): string {
  if (!name) return "–";
  return (
    name
      .replace(/,\s*--/g, "")
      .replace(/\s*\|\s*--\s*$/, "")
      .replace(/\s*\|\s*$/, "")
      .trim() || "–"
  );
}

const WP_DOC_TYPES = [
  "auftragsbestätigung",
  "auftragsbestaetigung",
  "wp",
  "wärmepumpe",
  "waermepumpe",
];

function isWpConfirmation(typeName: string | null): boolean {
  if (!typeName) return false;
  const lower = typeName.toLowerCase();
  return WP_DOC_TYPES.some((t) => lower.includes(t));
}

/** Hash-basierte Farbe fuer Projekt-Avatar */
const AVATAR_PALETTE = [
  "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
];

function avatarFor(key: string): { initials: string; cls: string } {
  const clean = (key || "").trim();
  if (!clean) return { initials: "?", cls: AVATAR_PALETTE[0] };
  // Initials: ersten 2 nicht-Symbol-Zeichen
  const stripped = clean.replace(/[^A-Z0-9a-zäöüÄÖÜß]/g, "");
  const initials = stripped.slice(0, 2).toUpperCase() || "?";
  let hash = 0;
  for (let i = 0; i < clean.length; i++)
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  return { initials, cls: AVATAR_PALETTE[hash % AVATAR_PALETTE.length] };
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return "–";
  }
}

export function HeizlastView({ projects, heroProjectLinkTemplate }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.project_number, p.project_name, p.customer_name, p.customer_address]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [projects, search]);

  // Stats fuer die Header-Pille
  const stats = useMemo(() => {
    let total = projects.length;
    let withWp = 0;
    let totalDocs = 0;
    for (const p of projects) {
      totalDocs += p.documents.length;
      if (p.documents.some((d) => isWpConfirmation(d.document_type_name))) withWp++;
    }
    return { total, withWp, totalDocs };
  }, [projects]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(filtered.map((p) => p.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  const allExpanded = filtered.length > 0 && expanded.size === filtered.length;

  return (
    <div className="space-y-4">
      {/* Header / Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50">
            <Flame size={18} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">
              Projekte in Angebotsprüfung
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {stats.total} Projekte · {stats.withWp} mit WP-AB · {stats.totalDocs} Dokumente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {allExpanded ? "Alle einklappen" : "Alle ausklappen"}
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/40 px-3 py-2">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
          />
          <Input
            placeholder="Projekt, Kunde oder Adresse suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 text-sm"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X size={12} /> Reset
          </button>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
          {filtered.length} {filtered.length === 1 ? "Eintrag" : "Einträge"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasSearch={!!search} />
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              expanded={expanded.has(project.id)}
              onToggle={() => toggle(project.id)}
              heroProjectLinkTemplate={heroProjectLinkTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggle,
  heroProjectLinkTemplate,
}: {
  project: HeizlastProject;
  expanded: boolean;
  onToggle: () => void;
  heroProjectLinkTemplate: string | null;
}) {
  const wpDocs = project.documents.filter((d) =>
    isWpConfirmation(d.document_type_name),
  );
  const otherDocs = project.documents.filter(
    (d) => !isWpConfirmation(d.document_type_name),
  );
  const cleanName = cleanProjectName(project.project_name);
  const avatar = avatarFor(project.project_number || cleanName);
  const heroHref = heroProjectLinkTemplate
    ? heroProjectLinkTemplate.replace("{projectId}", project.id)
    : null;
  const hasWp = wpDocs.length > 0;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-card transition-all duration-200 ${
        expanded
          ? "shadow-lg ring-1 ring-foreground/10"
          : "hover:shadow-md hover:-translate-y-0.5 hover:border-foreground/10"
      }`}
    >
      {/* WP-Highlight Bar wenn AB vorhanden */}
      {hasWp && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"
          aria-hidden
        />
      )}

      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 text-left pl-5 pr-3 py-4 flex items-start gap-3.5 min-w-0"
        >
          {/* Avatar mit Projektnummer-Initials */}
          <div
            className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center text-[11px] font-bold tabular-nums ${avatar.cls}`}
            title={project.project_number ?? "Projekt"}
          >
            {avatar.initials}
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Header: Projektname + Datum */}
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold leading-snug truncate">
                {cleanName}
              </h3>
              <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap shrink-0">
                {formatDate(project.maturity_date)}
              </span>
            </div>

            {/* Kunde + Adresse */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {project.customer_name && (
                <span className="truncate max-w-[260px]">
                  {project.customer_name}
                </span>
              )}
              {project.customer_address && (
                <span className="inline-flex items-center gap-1 truncate max-w-[300px]">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{project.customer_address}</span>
                </span>
              )}
            </div>

            {/* Meta-Zeile: Projektnummer + Doc-Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
                {project.project_number ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                <FileText size={10} /> {project.documents.length} Dok.
              </span>
              {hasWp && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50">
                  <Sparkles size={10} /> WP-AB
                </span>
              )}
            </div>
          </div>

          <ChevronDown
            size={18}
            className={`text-muted-foreground/50 mt-1 shrink-0 transition-transform duration-200 ${
              expanded ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>

        {heroHref && (
          <a
            href={heroHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="In Hero öffnen"
            className="shrink-0 flex items-center justify-center w-12 border-l border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>

      {/* Expanded Content */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t bg-gradient-to-b from-muted/30 to-muted/10 px-5 py-4 space-y-4">
            {wpDocs.length > 0 && (
              <DocGroup
                title="Auftragsbestätigung WP"
                icon={<Sparkles size={12} />}
                docs={wpDocs}
                highlight
              />
            )}

            {otherDocs.length > 0 && (
              <DocGroup
                title="Weitere Dokumente"
                icon={<FileText size={12} />}
                docs={otherDocs}
              />
            )}

            {project.documents.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Keine Dokumente vorhanden.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocGroup({
  title,
  icon,
  docs,
  highlight,
}: {
  title: string;
  icon: React.ReactNode;
  docs: HeizlastProject["documents"];
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${
            highlight
              ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        <p
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            highlight
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground"
          }`}
        >
          {title}
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground/60">
          {docs.length}
        </span>
        <div className="flex-1 h-px bg-border/40 ml-1" />
      </div>
      <div className="space-y-1">
        {docs.map((doc) => (
          <DocRow key={doc.id} doc={doc} highlight={highlight} />
        ))}
      </div>
    </div>
  );
}

function DocRow({
  doc,
  highlight,
}: {
  doc: HeizlastProject["documents"][0];
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 transition-colors ${
        highlight
          ? "bg-amber-50/60 ring-1 ring-amber-200/50 hover:bg-amber-50 dark:bg-amber-950/20 dark:ring-amber-900/40 dark:hover:bg-amber-950/30"
          : "bg-background/80 ring-1 ring-border/40 hover:bg-background"
      }`}
    >
      <FileText
        size={13}
        className={
          highlight
            ? "text-amber-600 dark:text-amber-400 shrink-0"
            : "text-muted-foreground shrink-0"
        }
      />
      <span
        className={`flex-1 truncate ${
          highlight
            ? "text-amber-800 dark:text-amber-300 font-medium"
            : "text-foreground/90"
        }`}
      >
        {doc.document_type_name ?? "Unbekannter Typ"}
        {doc.nr && (
          <span className="ml-1.5 font-mono text-[10px] opacity-60">
            #{doc.nr}
          </span>
        )}
      </span>
      {doc.document_date && (
        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
          {formatDate(doc.document_date)}
        </span>
      )}
      {doc.status_name && (
        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
          {doc.status_name}
        </span>
      )}
      {doc.file_url ? (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 grid place-items-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Dokument öffnen"
        >
          <ExternalLink size={11} />
        </a>
      ) : (
        <span className="w-6" />
      )}
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16 px-4 text-center">
      <div className="rounded-full bg-orange-100 dark:bg-orange-950/40 p-3 mb-3">
        <Flame
          size={22}
          className="text-orange-600 dark:text-orange-400"
        />
      </div>
      <p className="text-sm font-medium">
        {hasSearch
          ? "Keine Treffer"
          : "Keine Projekte in Angebotsprüfung"}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        {hasSearch
          ? "Andere Begriffe versuchen oder Suche zurücksetzen."
          : "Daten werden nach dem nächsten Hero-Sync verfügbar."}
      </p>
    </div>
  );
}
