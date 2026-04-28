"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { HeizlastProject } from "@/lib/supabase/hero-heizlast-queries";

interface Props {
  projects: HeizlastProject[];
  heroProjectLinkTemplate: string | null;
}

/** Bereinigt Hero-Projektnamen wie "-7558 | --, --, --" → "-7558" */
function cleanProjectName(name: string | null): string {
  if (!name) return "–";
  // Entferne alle ", --" Segmente, dann trailing " | --" oder " | "
  return name
    .replace(/,\s*--/g, "")
    .replace(/\s*\|\s*--\s*$/, "")
    .replace(/\s*\|\s*$/, "")
    .trim() || "–";
}

const WP_DOC_TYPES = ["auftragsbestätigung", "auftragsbestaetigung", "wp", "wärmepumpe", "waermepumpe"];

function isWpConfirmation(typeName: string | null): boolean {
  if (!typeName) return false;
  const lower = typeName.toLowerCase();
  return WP_DOC_TYPES.some((t) => lower.includes(t));
}

export function HeizlastView({ projects, heroProjectLinkTemplate }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = search.trim()
    ? projects.filter((p) =>
        [p.project_number, p.project_name, p.customer_name, p.customer_address]
          .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : projects;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Projekt, Kunde oder Adresse suchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-72 h-8 text-sm"
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <p className="text-sm">Keine Projekte in Angebotsprüfung gefunden.</p>
          <p className="text-xs">Daten werden nach dem nächsten Hero-Sync verfügbar.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          {filtered.map((project, idx) => {
            const open = expanded.has(project.id);
            const wpDocs = project.documents.filter((d) => isWpConfirmation(d.document_type_name));
            const otherDocs = project.documents.filter((d) => !isWpConfirmation(d.document_type_name));

            return (
              <div key={project.id}>
                {idx > 0 && <div className="border-t" />}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggle(project.id)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    {open ? <ChevronDown size={15} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={15} className="shrink-0 text-muted-foreground" />}
                    <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{project.project_number ?? "–"}</span>
                    <span className="text-sm font-medium flex-1 truncate">{cleanProjectName(project.project_name)}</span>
                    <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[200px]">{project.customer_name ?? ""}</span>
                    {project.maturity_date && (
                      <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
                        {new Date(project.maturity_date).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    )}
                    <Badge variant="secondary" className="shrink-0 ml-2">{project.documents.length} Dok.</Badge>
                  </button>
                  {heroProjectLinkTemplate && (
                    <a
                      href={heroProjectLinkTemplate.replace("{projectId}", project.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="In Hero öffnen"
                      className="shrink-0 px-3 py-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>

                {open && (
                  <div className="bg-muted/20 px-4 pb-3 pt-1 border-t space-y-3">
                    {project.customer_address && (
                      <p className="text-xs text-muted-foreground">{project.customer_address}</p>
                    )}

                    {wpDocs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground/70">Auftragsbestätigung WP</p>
                        {wpDocs.map((doc) => (
                          <DocRow key={doc.id} doc={doc} highlight />
                        ))}
                      </div>
                    )}

                    {otherDocs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground/70">Weitere Dokumente</p>
                        {otherDocs.map((doc) => (
                          <DocRow key={doc.id} doc={doc} />
                        ))}
                      </div>
                    )}

                    {project.documents.length === 0 && (
                      <p className="text-xs text-muted-foreground">Keine Dokumente vorhanden.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, highlight }: { doc: HeizlastProject["documents"][0]; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${highlight ? "bg-amber-500/10 border border-amber-500/20" : "bg-background/60"}`}>
      <FileText size={12} className={highlight ? "text-amber-600 shrink-0" : "text-muted-foreground shrink-0"} />
      <span className={`flex-1 truncate ${highlight ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
        {doc.document_type_name ?? "Unbekannter Typ"}
        {doc.nr && <span className="ml-1 font-mono opacity-70">#{doc.nr}</span>}
      </span>
      {doc.document_date && (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(doc.document_date).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </span>
      )}
      {doc.status_name && (
        <Badge variant="outline" className="text-[10px] py-0 h-4">{doc.status_name}</Badge>
      )}
      {doc.file_url ? (
        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="Dokument öffnen">
          <ExternalLink size={12} />
        </a>
      ) : (
        <span className="w-3" />
      )}
    </div>
  );
}
