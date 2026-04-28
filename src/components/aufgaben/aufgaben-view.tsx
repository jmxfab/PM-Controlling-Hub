"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, X, MessageSquare, FolderOpen, CheckSquare, FileUp, ExternalLink } from "lucide-react";
import type { AufgabeEntry } from "@/lib/supabase/hero-aufgaben-queries";
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
  const emptyData: InfosData = { entries: [], total: 0, stats: { total: 0, unread: 0, aufgaben: 0 } };
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<InfosData>(emptyData);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (unread: boolean, q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), category: "aufgabe" });
      if (unread) params.set("unread", "1");
      if (q) params.set("search", q);
      const res = await window.fetch(`/api/aufgaben?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setData({ entries: json.entries ?? [], total: json.total ?? 0, stats: json.stats ?? emptyData.stats });
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(false, "", 0); }, [fetchData]);

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

      {!loading && data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <p className="text-sm">Keine Aufgaben gefunden.</p>
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
                  <TableHead className="w-10" />
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
                    <TableCell>
                      {e.target_id && (
                        <a
                          href={`/logbuch?project_id=${e.target_id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Projekt im Logbuch öffnen"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
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
