"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, X, MessageSquare, FolderOpen, CheckSquare, FileUp } from "lucide-react";
import type { AufgabeEntry } from "@/lib/supabase/hero-aufgaben-queries";

interface Stats { total: number; unread: number; aufgaben: number }
interface AufgabenData { entries: AufgabeEntry[]; total: number; stats: Stats }
interface Props { initial: AufgabenData }

const CATEGORY_TABS = [
  { value: "", label: "Alle" },
  { value: "aufgabe", label: "Aufgaben" },
  { value: "info", label: "Info" },
];

function notifIcon(title: string | null) {
  if (!title) return null;
  if (title.includes("Kommentar")) return <MessageSquare size={13} className="text-blue-500 shrink-0" />;
  if (title.includes("zugewiesen")) return <FolderOpen size={13} className="text-orange-500 shrink-0" />;
  if (title.includes("erledigt")) return <CheckSquare size={13} className="text-green-500 shrink-0" />;
  if (title.includes("Dokument")) return <FileUp size={13} className="text-muted-foreground shrink-0" />;
  return null;
}

export function AufgabenView({ initial }: Props) {
  const [category, setCategory] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AufgabenData>(initial);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(async (cat: string, unread: boolean, q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (cat) params.set("category", cat);
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
    debounceRef.current = setTimeout(() => { setPage(0); fetch(category, onlyUnread, search, 0); }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [category, onlyUnread, search, fetch]);

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const from = data.total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, data.total);

  function changePage(p: number) { setPage(p); fetch(category, onlyUnread, search, p); }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">{data.stats.total} gesamt</span>
        <span className="font-medium text-orange-600">{data.stats.unread} ungelesen</span>
        <span className="font-medium text-blue-600">{data.stats.aufgaben} offene Aufgaben</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_TABS.map((t) => (
          <Button
            key={t.value}
            variant={category === t.value ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setCategory(t.value)}
          >
            {t.label}
          </Button>
        ))}
        <Button
          variant={onlyUnread ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setOnlyUnread(!onlyUnread)}
        >
          Ungelesen
        </Button>
        <Input
          placeholder="Suche..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52 h-8 text-sm"
        />
        {(category || onlyUnread || search) && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground"
            onClick={() => { setCategory(""); setOnlyUnread(false); setSearch(""); }}>
            <X size={13} /> Zurücksetzen
          </Button>
        )}
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Lädt…</span>}
      </div>

      {/* Table */}
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
                  <TableHead className="w-24">Kategorie</TableHead>
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
                      <Badge
                        variant={e.category === "aufgabe" ? "default" : "secondary"}
                        className="text-xs font-normal"
                      >
                        {e.category === "aufgabe" ? "Aufgabe" : "Info"}
                      </Badge>
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
