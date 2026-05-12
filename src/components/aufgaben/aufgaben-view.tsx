"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, X, Mail, ChevronDown, Reply, Check, Clock3, CalendarDays, CalendarClock } from "lucide-react";
import type { HeizlastProject } from "@/lib/supabase/hero-heizlast-queries";
import type { MailTask, MailTasksPage, MailTaskCounts } from "@/lib/supabase/mail-tasks-queries";
import { HeizlastView } from "@/components/heizlast/heizlast-view";

const PAGE_SIZE = 50;

type FilterKey = "aufgaben" | "infos" | "inbox";

interface Props {
  heizlastProjects: HeizlastProject[];
  heroProjectLinkTemplate: string | null;
  initialAufgaben: MailTasksPage;
  counts: MailTaskCounts;
}

const PRIORITY_CONFIG: Record<NonNullable<MailTask["priority"]>, { label: string; cls: string }> = {
  urgent: { label: "Dringend", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  high:   { label: "Hoch",     cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  medium: { label: "Mittel",   cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low:    { label: "Niedrig",  cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export function AufgabenView({ heizlastProjects, heroProjectLinkTemplate, initialAufgaben, counts }: Props) {
  return (
    <Tabs defaultValue="aufgaben">
      <TabsList>
        <TabsTrigger value="aufgaben">
          Aufgaben
          {counts.aufgaben > 0 ? (
            <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
              ({counts.aufgaben})
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="infos">
          Infos
          {counts.infos > 0 ? (
            <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
              ({counts.infos})
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="inbox">
          Inbox
          {counts.inbox > 0 ? (
            <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
              ({counts.inbox})
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="heizlast">
          Heizlast
          {heizlastProjects.length > 0 ? (
            <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
              ({heizlastProjects.length})
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="aufgaben" className="mt-4">
        <MailTab initial={initialAufgaben} filter="aufgaben" />
      </TabsContent>
      <TabsContent value="infos" className="mt-4">
        <MailTab initial={{ entries: [], total: 0 }} filter="infos" />
      </TabsContent>
      <TabsContent value="inbox" className="mt-4">
        <MailTab initial={{ entries: [], total: 0 }} filter="inbox" />
      </TabsContent>
      <TabsContent value="heizlast" className="mt-4">
        <HeizlastView
          projects={heizlastProjects}
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
    </Tabs>
  );
}

function MailTab({ initial, filter }: { initial: MailTasksPage; filter: FilterKey }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<MailTasksPage>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [replyTask, setReplyTask] = useState<MailTask | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), filter });
      if (q) params.set("search", q);
      const res = await window.fetch(`/api/mail-tasks?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Fehler ${res.status} beim Laden der Mail-Aufgaben`);
        return;
      }
      const json = await res.json();
      setData({ entries: json.entries ?? [], total: json.total ?? 0 });
      setHasFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Lazy-load when tab gets shown for the first time (initial.entries is empty for non-default tabs)
  useEffect(() => {
    if (!hasFetched && initial.entries.length === 0 && initial.total === 0) {
      fetchData("", 0);
    }
  }, [hasFetched, initial.entries.length, initial.total, fetchData]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(0); fetchData(search, 0); }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, fetchData]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, data.total);

  function changePage(p: number) { setPage(p); fetchData(search, p); }

  async function patchTask(taskId: string, update: { status?: MailTask["status"]; due_date?: string | null }) {
    setBusyTaskId(taskId);
    try {
      const res = await window.fetch(`/api/mail-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Fehler ${res.status} beim Aktualisieren`);
        return;
      }
      // Local optimistic update
      setData((prev) => ({
        ...prev,
        entries: prev.entries.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: update.status ?? t.status,
                due_date: update.due_date !== undefined ? update.due_date : t.due_date,
              }
            : t,
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Netzwerk-Fehler");
    } finally {
      setBusyTaskId(null);
    }
  }

  function markDone(task: MailTask) {
    return patchTask(task.id, { status: task.status === "done" ? "open" : "done" });
  }

  function snoozeBy(task: MailTask, ms: number) {
    const due = new Date(Date.now() + ms).toISOString();
    return patchTask(task.id, { due_date: due, status: "waiting" });
  }

  function buildMailto(task: MailTask): string | null {
    if (!task.sender) return null;
    return `mailto:${task.sender}?subject=${encodeURIComponent("Re: " + task.title)}`;
  }

  function openReply(task: MailTask) {
    setReplyTask(task);
  }

  async function sendReply(task: MailTask, message: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await window.fetch(`/api/mail-tasks/${task.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error ?? `Fehler ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Netzwerk-Fehler" };
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Suche..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52 h-8 text-sm"
        />
        {search && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground"
            onClick={() => setSearch("")}>
            <X size={13} /> Zurücksetzen
          </Button>
        )}
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Lädt…</span>}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-sm">
          <p className="font-medium text-red-700 dark:text-red-400">Fehler beim Laden</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 font-mono break-all">{error}</p>
          <Button variant="outline" size="sm" className="mt-3 h-7"
            onClick={() => fetchData(search, page)}>
            Erneut versuchen
          </Button>
        </div>
      ) : !loading && data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Mail size={24} className="text-muted-foreground/40" />
          <p className="text-sm">Keine E-Mail-Aufgaben in der Datenbank.</p>
          <p className="text-xs">
            {search
              ? "Suche liefert keine Treffer. Suchbegriff anpassen oder zurücksetzen."
              : "Sobald der n8n-Workflow neue Mails klassifiziert, erscheinen sie hier."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9" />
                  <TableHead className="w-36">Datum</TableHead>
                  <TableHead className="w-24">Prio</TableHead>
                  <TableHead className="w-56">Absender</TableHead>
                  <TableHead>Titel / Aktion</TableHead>
                  <TableHead className="w-32">Fällig</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((t) => {
                  const prio = t.priority ? PRIORITY_CONFIG[t.priority] : null;
                  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
                  const isDone = t.status === "done";
                  const isWaiting = t.status === "waiting";
                  const isExpanded = expanded === t.id;
                  const mailto = buildMailto(t);
                  const isBusy = busyTaskId === t.id;
                  return (
                    <>
                      <TableRow
                        key={t.id}
                        className={`cursor-pointer hover:bg-muted/40 ${isDone ? "opacity-50" : ""}`}
                        onClick={() => setExpanded(isExpanded ? null : t.id)}
                      >
                        <TableCell className="text-muted-foreground">
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                          />
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                          {new Date(t.created_at).toLocaleString("de-AT", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {prio ? (
                            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${prio.cls}`}>
                              {prio.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.sender ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <Mail size={12} className="text-blue-500 shrink-0" />
                              <span className="truncate">{t.sender}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">manuell</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className={`font-medium ${isDone ? "line-through" : ""}`}>{t.title}</div>
                          {t.body && !isExpanded && (
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.body}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {t.due_date ? (
                            <span className={isOverdue ? "text-red-500 font-medium" : isWaiting ? "text-blue-500" : "text-muted-foreground"}>
                              {new Date(t.due_date).toLocaleString("de-AT", {
                                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${t.id}-expand`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={5} className="py-4">
                            <div className="space-y-3">
                              {t.body && (
                                <div className="whitespace-pre-wrap text-sm leading-relaxed max-w-3xl">
                                  {t.body}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {t.source_email_id ? (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-8 gap-1.5"
                                    onClick={(e) => { e.stopPropagation(); openReply(t); }}
                                  >
                                    <Reply size={13} />
                                    Antworten
                                  </Button>
                                ) : mailto ? (
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5"
                                  >
                                    <a
                                      href={mailto}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Diese Task wurde vor dem Reply-Feature erstellt — öffnet lokalen Mail-Client"
                                    >
                                      <Reply size={13} />
                                      Antworten (Outlook)
                                    </a>
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant={isDone ? "outline" : "default"}
                                  className="h-8 gap-1.5"
                                  disabled={isBusy}
                                  onClick={(e) => { e.stopPropagation(); markDone(t); }}
                                >
                                  <Check size={13} />
                                  {isDone ? "Wieder offen" : "Erledigt"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5"
                                  disabled={isBusy || isDone}
                                  onClick={(e) => { e.stopPropagation(); snoozeBy(t, 3 * 60 * 60 * 1000); }}
                                >
                                  <Clock3 size={13} />
                                  +3 Std
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5"
                                  disabled={isBusy || isDone}
                                  onClick={(e) => { e.stopPropagation(); snoozeBy(t, 24 * 60 * 60 * 1000); }}
                                >
                                  <CalendarDays size={13} />
                                  Morgen
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5"
                                  disabled={isBusy || isDone}
                                  onClick={(e) => { e.stopPropagation(); snoozeBy(t, 7 * 24 * 60 * 60 * 1000); }}
                                >
                                  <CalendarClock size={13} />
                                  +1 Woche
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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
      )}

      {replyTask && (
        <ReplyModal
          task={replyTask}
          onClose={() => setReplyTask(null)}
          onSent={() => {
            setReplyTask(null);
            // optimistic: nach Antwort als 'in_progress' markieren
            patchTask(replyTask.id, { status: "in_progress" });
          }}
          onSend={(msg) => sendReply(replyTask, msg)}
        />
      )}
    </div>
  );
}

function ReplyModal({
  task,
  onClose,
  onSent,
  onSend,
}: {
  task: MailTask;
  onClose: () => void;
  onSent: () => void;
  onSend: (message: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setErr(null);
    const res = await onSend(message.trim());
    setSending(false);
    if (res.ok) {
      onSent();
    } else {
      setErr(res.error ?? "Senden fehlgeschlagen");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border rounded-lg shadow-lg w-full max-w-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">An: {task.sender ?? "(unbekannt)"}</p>
          <p className="text-sm font-medium">Re: {task.title}</p>
        </div>
        <textarea
          className="w-full h-40 rounded-md border bg-background p-3 text-sm font-sans resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Deine Antwort..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
          autoFocus
        />
        {err && (
          <div className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{err}</div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={handleSend} disabled={sending || !message.trim()} className="gap-1.5">
            <Reply size={13} />
            {sending ? "Sende..." : "Senden"}
          </Button>
        </div>
      </div>
    </div>
  );
}
