"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ChevronDown, X, MessageSquare, FolderOpen, CheckSquare, FileUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AufgabeEntry } from "@/lib/supabase/hero-aufgaben-queries";
import type { LogbuchEntry } from "@/lib/supabase/hero-logbuch-queries";

const DOMENIC_EMAIL = "d.wagenleitner@jumax-elektro.de";
const PAGE_SIZE = 50;

interface Stats { total: number; unread: number; aufgaben: number }
interface InfosData { entries: AufgabeEntry[]; total: number; stats: Stats }
interface Props { initial: InfosData }

function notifIcon(title: string | null) {
  if (!title) return null;
  if (title.includes("Kommentar")) return <MessageSquare size={13} className="text-blue-500 shrink-0" />;
  if (title.includes("zugewiesen")) return <FolderOpen size={13} className="text-orange-500 shrink-0" />;
  if (title.includes("erledigt")) return <CheckSquare size={13} className="text-green-500 shrink-0" />;
  if (title.includes("Dokument")) return <FileUp size={13} className="text-muted-foreground shrink-0" />;
  return null;
}

export function AufgabenView({ initial }: Props) {
  return (
    <Tabs defaultValue="infos">
      <TabsList>
        <TabsTrigger value="infos">Infos</TabsTrigger>
        <TabsTrigger value="aufgaben">Aufgaben</TabsTrigger>
      </TabsList>
      <TabsContent value="infos" className="mt-4">
        <InfosTab initial={initial} />
      </TabsContent>
      <TabsContent value="aufgaben" className="mt-4">
        <AufgabenTab />
      </TabsContent>
    </Tabs>
  );
}

function InfosTab({ initial }: { initial: InfosData }) {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<InfosData>(initial);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (unread: boolean, q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), category: "info" });
      if (unread) params.set("unread", "1");
      if (q) params.set("search", q);
      const res = await window.fetch(`/api/aufgaben?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setData({ entries: json.entries ?? [], total: json.total ?? 0, stats: json.stats ?? initial.stats });
    } finally {
      setLoading(false);
    }
  }, [initial.stats]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(0); fetchData(onlyUnread, search, 0); }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [onlyUnread, search, fetchData]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, data.total);

  function changePage(p: number) { setPage(p); fetchData(onlyUnread, search, p); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={onlyUnread ? "default" : "outline"} size="sm" className="h-8"
          onClick={() => setOnlyUnread(!onlyUnread)}>
          Ungelesen
        </Button>
        <Input
          placeholder="Suche..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52 h-8 text-sm"
        />
        {(onlyUnread || search) && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground"
            onClick={() => { setOnlyUnread(false); setSearch(""); }}>
            <X size={13} /> Zurücksetzen
          </Button>
        )}
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Lädt…</span>}
      </div>

      {data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <p className="text-sm">Keine Einträge gefunden.</p>
          <p className="text-xs">Daten werden nach dem nächsten Hero-Sync verfügbar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Datum</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Nachricht</TableHead>
                  <TableHead className="w-48">Projekt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e.id} className={!e.is_read ? "bg-muted/30" : undefined}>
                    <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {e.notification_date
                        ? new Date(e.notification_date).toLocaleString("de-AT", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "–"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        {notifIcon(e.title)}
                        <span className={!e.is_read ? "font-medium" : ""}>{e.title ?? "–"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {e.body ?? "–"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.project_number || e.project_name ? (
                        <span>
                          {e.project_number && (
                            <span className="font-mono text-xs mr-1.5 text-muted-foreground">{e.project_number}</span>
                          )}
                          {e.project_name}
                        </span>
                      ) : e.target_id ? (
                        <span className="text-xs text-muted-foreground font-mono">{e.target_id}</span>
                      ) : "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{from}–{to} von {data.total.toLocaleString("de-AT")} Einträgen</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => changePage(page - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span>{page + 1} / {totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => changePage(page + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AufgabenTab() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ entries: LogbuchEntry[]; total: number }>({ entries: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        user_email: DOMENIC_EMAIL,
        page_size: String(PAGE_SIZE),
      });
      const res = await window.fetch(`/api/logbuch?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setData({ entries: json.entries ?? [], total: json.total ?? 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(0); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, data.total);

  function changePage(p: number) { setPage(p); fetchData(p); }
  function toggle(id: string) { setExpandedId((c) => (c === id ? null : id)); }

  if (loading && data.entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <span className="text-sm animate-pulse">Lädt…</span>
      </div>
    );
  }

  if (!loading && data.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <p className="text-sm">Keine Aufgaben gefunden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {loading && <span className="text-xs text-muted-foreground animate-pulse">Lädt…</span>}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-40">Datum</TableHead>
              <TableHead>Eintrag</TableHead>
              <TableHead className="w-52">Projekt</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const label = entry.custom_title ?? entry.description ?? entry.event_type ?? "–";
              return (
                <Fragment key={entry.id}>
                  <TableRow
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggle(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(entry.id); }
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="py-2">
                      <ChevronDown
                        size={14}
                        className={cn("text-muted-foreground transition-transform", isExpanded ? "rotate-0" : "-rotate-90")}
                      />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {entry.entry_date
                        ? new Date(entry.entry_date).toLocaleString("de-AT", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "–"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        {entry.event_type && (
                          <Badge variant="secondary" className="text-xs font-normal shrink-0">{entry.event_type}</Badge>
                        )}
                        <span className="truncate max-w-xs">{label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.project_number || entry.project_name ? (
                        <span>
                          {entry.project_number && (
                            <span className="font-mono text-xs mr-1.5 text-muted-foreground">{entry.project_number}</span>
                          )}
                          {entry.project_name}
                        </span>
                      ) : entry.project_match_id ? (
                        <span className="text-xs text-muted-foreground font-mono">{entry.project_match_id}</span>
                      ) : "–"}
                    </TableCell>
                    <TableCell>
                      {entry.project_match_id && (
                        <a
                          href={`/logbuch?project_id=${entry.project_match_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Projekt im Logbuch öffnen"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5} className="p-0">
                        <AufgabeEntryDetails entry={entry} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{from}–{to} von {data.total.toLocaleString("de-AT")} Einträgen</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => changePage(page - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span>{page + 1} / {totalPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => changePage(page + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AufgabeEntryDetails({ entry }: { entry: LogbuchEntry }) {
  const text = entry.custom_text ?? entry.description;
  const projectLabel = [entry.project_number, entry.project_name].filter(Boolean).join(" ") || entry.project_match_id;

  return (
    <div className="space-y-3 p-4">
      {text && (
        <section className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eintrag</h4>
          <blockquote className="border-l-2 border-primary/40 bg-background/40 pl-3 pr-2 py-2 text-sm italic text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {`\u201E${text}\u201C`}
          </blockquote>
        </section>
      )}

      <section className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ereignistyp</div>
          <div>{entry.event_type ?? "–"}</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mitarbeiter</div>
          <div>{entry.author_name ?? entry.user_email ?? "–"}</div>
        </div>
        {projectLabel && (
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projekt</div>
            <div>{projectLabel}</div>
          </div>
        )}
        {entry.project_match_id && (
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Im Logbuch öffnen</div>
            <a
              href={`/logbuch?project_id=${entry.project_match_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink size={13} />
              Alle Einträge für dieses Projekt
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
