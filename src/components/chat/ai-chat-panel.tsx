"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Send,
  Mic,
  Square,
  X,
  Sparkles,
  Loader2,
  Wrench,
  Trash2,
  History,
  Plus,
  Search,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { diagnoseMicError } from "@/components/aufgaben/voice-task-dialog";

type Role = "user" | "assistant";

interface ChatMsg {
  role: Role;
  content: string;
  /** Welche Tools wurden in dieser Antwort genutzt? (nur fuer assistant) */
  toolNames?: string[];
}

const STORAGE_KEY = "ai-chat:messages";
const SESSION_KEY = "ai-chat:sessionId";
const MAX_HISTORY = 30;
const MAX_RECORDING_SECONDS = 300; // 5 Min Hard-Cap, dann Auto-Stop

interface SessionListItem {
  id: string;
  title: string | null;
  updated_at: string;
  message_count: number;
}

function loadHistory(): ChatMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMsg =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

function saveHistory(msgs: ChatMsg[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = msgs.slice(-MAX_HISTORY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* silent */
  }
}

/**
 * Rechter Slide-in Chat-Panel mit Claude. Kann via Tool-Use auf die DB
 * zugreifen (Tasks, Hero, Logbuch). Voice-Input via Mikrofon.
 */
export function AiChatPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  // Server-side Session-ID — wird vom Backend beim ersten Send vergeben
  const [sessionId, setSessionId] = useState<string | null>(null);
  // History-Drawer State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDays, setHistoryDays] = useState<"7" | "30" | "365">("30");
  const [historyList, setHistoryList] = useState<SessionListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lade History + Session-ID beim Mount
  useEffect(() => {
    setMessages(loadHistory());
    if (typeof window !== "undefined") {
      const sid = window.localStorage.getItem(SESSION_KEY);
      if (sid) setSessionId(sid);
    }
  }, []);

  // Persist History
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Scroll auto-down bei neuen Messages
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, transcribing]);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (streamRef.current) {
        for (const tr of streamRef.current.getTracks()) tr.stop();
      }
    };
  }, []);

  // Keyboard-Shortcut: ⌘/Ctrl + . toggled Panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    const next: ChatMsg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          sessionId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Fehler ${res.status}`);
        return;
      }
      // Session-ID persistieren (Server vergibt sie beim ersten Call)
      if (typeof json.sessionId === "string" && json.sessionId !== sessionId) {
        setSessionId(json.sessionId);
        try {
          window.localStorage.setItem(SESSION_KEY, json.sessionId);
        } catch {
          /* silent */
        }
      }
      const reply: ChatMsg = {
        role: "assistant",
        content: typeof json.reply === "string" ? json.reply : "(leere Antwort)",
        toolNames: Array.isArray(json.toolCalls)
          ? (json.toolCalls as Array<{ name?: string }>).map(
              (c) => c?.name ?? "?",
            )
          : undefined,
      };
      setMessages((m) => [...m, reply]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(false);
      // Re-Fokus aufs Input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function clearHistory() {
    if (!window.confirm("Chat-Verlauf wirklich loeschen?")) return;
    setMessages([]);
    setSessionId(null);
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* silent */
    }
  }

  function startNewSession() {
    setMessages([]);
    setSessionId(null);
    setError(null);
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* silent */
    }
  }

  async function openHistory() {
    setHistoryOpen(true);
    await fetchHistory(historySearch, historyDays);
  }

  async function fetchHistory(search: string, days: string) {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ days });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/ai/chat/sessions?${params}`);
      const json = await res.json().catch(() => ({}));
      setHistoryList(Array.isArray(json.sessions) ? json.sessions : []);
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadSession(id: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/ai/chat/sessions/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Konnte Session nicht laden");
        return;
      }
      const loaded: ChatMsg[] = (json.messages ?? []).map(
        (m: { role: Role; content: string; tool_names?: string[] }) => ({
          role: m.role,
          content: m.content,
          toolNames: m.tool_names ?? undefined,
        }),
      );
      setMessages(loaded);
      setSessionId(id);
      try {
        window.localStorage.setItem(SESSION_KEY, id);
      } catch {
        /* silent */
      }
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function deleteSession(id: string) {
    if (!window.confirm("Diese Konversation loeschen?")) return;
    await fetch(`/api/ai/chat/sessions/${id}`, { method: "DELETE" });
    setHistoryList((l) => l.filter((s) => s.id !== id));
    if (id === sessionId) {
      setSessionId(null);
      setMessages([]);
      try {
        window.localStorage.removeItem(SESSION_KEY);
      } catch {
        /* silent */
      }
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "",
      ];
      const mime =
        candidates.find((m) =>
          m === "" ? true : MediaRecorder.isTypeSupported(m),
        ) ?? "";
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: mime || rec.mimeType || "audio/webm",
        });
        cleanupStream();
        await transcribe(blob);
      };
      rec.start(500);
      setRecording(true);
      const t0 = Date.now();
      recordTimerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000);
        setRecordingElapsed(sec);
        // Hartes Auto-Stop nach MAX_RECORDING_SECONDS
        if (sec >= MAX_RECORDING_SECONDS) {
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state !== "inactive"
          ) {
            mediaRecorderRef.current.stop();
            setRecording(false);
          }
        }
      }, 250);
    } catch (e) {
      setError(diagnoseMicError(e));
      cleanupStream();
      setRecording(false);
    }
  }

  function cleanupStream() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const tr of streamRef.current.getTracks()) tr.stop();
      streamRef.current = null;
    }
    setRecordingElapsed(0);
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4")
        ? "mp4"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      fd.append("file", blob, `chat.${ext}`);
      const res = await fetch("/api/speech/transcribe-only", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Whisper-Fehler ${res.status}`);
        return;
      }
      const t = typeof json.transcript === "string" ? json.transcript : "";
      // Client-side Halluzinations-Filter als zweite Verteidigungslinie
      // (Server filtert auch, aber falls dort mal was durchrutscht).
      const HALLUCINATIONS = [
        /^untertitel(ung)?( der amara\.org-community)?\.?$/i,
        /^vielen dank f(ue|ü)rs? zuschauen[.!]?$/i,
        /^danke f(ue|ü)r['s]* zuschauen[.!]?$/i,
        /^bis zum n(ae|ä)chsten mal[.!]?$/i,
        /^musik\.?$/i,
        /^\[musik\]$/i,
      ];
      if (!t || HALLUCINATIONS.some((re) => re.test(t.trim()))) {
        setError("Leeres Transkript (oder nur Stille). Bitte nochmal sprechen.");
        return;
      }
      // Transkript wird direkt gesendet (kein Vor-Edit). Wer's editieren
      // will, tippt stattdessen.
      await send(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transkription fehlgeschlagen");
    } finally {
      setTranscribing(false);
    }
  }

  // Auf Login-Seite nicht anzeigen (kein eingeloggter Kontext)
  if (pathname?.startsWith("/login")) return null;

  return (
    <>
      {/* Floating-Toggle-Button — sichtbar wenn Panel zu ist */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 grid place-items-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform"
          aria-label="AI-Chat oeffnen"
          title="AI-Chat (Strg/Cmd + .)"
        >
          <Sparkles size={18} />
        </button>
      )}

      {/* Slide-in Panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-[100dvh] w-full sm:w-[400px] bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5 shrink-0">
          <div className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white">
            <Sparkles size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">
              Hub-Assistent
            </div>
            <div className="text-[10px] text-muted-foreground">
              Durchsucht Aufgaben · Hero · Logbuch
            </div>
          </div>
          <button
            type="button"
            onClick={openHistory}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted/60"
            title="Verlauf"
            aria-label="Verlauf oeffnen"
          >
            <History size={14} />
          </button>
          <button
            type="button"
            onClick={startNewSession}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted/60"
            title="Neue Konversation"
            aria-label="Neue Konversation"
          >
            <Plus size={14} />
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="text-muted-foreground hover:text-rose-500 p-1.5 rounded hover:bg-muted/60"
              title="Verlauf loeschen"
              aria-label="Verlauf loeschen"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted/60"
            aria-label="Schliessen"
          >
            <X size={16} />
          </button>
        </div>

        {/* History-Drawer (overlay innerhalb Panel) */}
        {historyOpen && (
          <div className="absolute inset-0 top-[57px] z-10 bg-card flex flex-col">
            <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted/60"
                aria-label="Zurueck"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="text-sm font-semibold">Verlauf</div>
              <div className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                {historyList.length}
              </div>
            </div>
            {/* Filter */}
            <div className="border-b px-3 py-2 shrink-0 space-y-2">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Suche im Verlauf…"
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      fetchHistory(historySearch, historyDays);
                  }}
                  className="w-full h-8 pl-7 pr-2 text-[12.5px] rounded-lg border bg-background/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="flex gap-1">
                {(["7", "30", "365"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setHistoryDays(d);
                      fetchHistory(historySearch, d);
                    }}
                    className={`flex-1 text-[11px] px-2 py-1 rounded-md transition-colors ${
                      historyDays === d
                        ? "bg-foreground text-background font-medium"
                        : "bg-muted/60 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {d === "7" ? "7 T" : d === "30" ? "30 T" : "1 J"}
                  </button>
                ))}
              </div>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {historyLoading && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-[12px]">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Lade…
                </div>
              )}
              {!historyLoading && historyList.length === 0 && (
                <div className="text-center text-[12px] text-muted-foreground py-8 px-3">
                  Keine Konversationen
                  {historySearch ? ` zu "${historySearch}"` : ""} gefunden.
                </div>
              )}
              {historyList.map((s) => (
                <div
                  key={s.id}
                  className={`group rounded-lg border bg-background/40 hover:bg-background/80 hover:border-foreground/15 transition-colors ${
                    s.id === sessionId ? "border-blue-500/40" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadSession(s.id)}
                    className="w-full text-left px-2.5 py-2"
                  >
                    <div className="text-[12.5px] font-medium line-clamp-2">
                      {s.title || "(ohne Titel)"}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                      <span>
                        {new Date(s.updated_at).toLocaleString("de-AT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="tabular-nums">
                        {s.message_count} Msg.
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSession(s.id)}
                    className="absolute opacity-0 group-hover:opacity-100 right-2 top-2 p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                    title="Loeschen"
                    aria-label="Loeschen"
                    style={{ position: "relative", float: "right" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
        >
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <div className="mx-auto w-12 h-12 grid place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-950/40 dark:to-violet-950/40">
                <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Frag mich was.</p>
                <p className="text-[11px] text-muted-foreground px-4">
                  Ich kann Aufgaben, Hero-Projekte und Logbuch-Eintraege durchsuchen.
                </p>
              </div>
              <div className="space-y-1.5 px-2 pt-2">
                {[
                  "Was steht heute in Mein Tag?",
                  "Zeig mir alle offenen Beschwerden",
                  "Status zu Projekt PVS-9402?",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="block w-full text-left px-3 py-2 rounded-lg border border-border/60 bg-background/60 hover:bg-muted/60 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-muted/70 text-foreground"
                }`}
              >
                {m.content}
                {m.toolNames && m.toolNames.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-foreground/10 flex flex-wrap gap-1">
                    {m.toolNames.map((n, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider opacity-60"
                      >
                        <Wrench size={8} />
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(busy || transcribing) && (
            <div className="flex justify-start">
              <div className="bg-muted/70 rounded-2xl px-3 py-2 text-[13px] flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                {transcribing ? "Transkribiere…" : "Suche & antworte…"}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mb-2 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 px-2.5 py-1.5 text-[12px] text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Input */}
        <form
          className="border-t px-3 py-2.5 shrink-0 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={
              recording
                ? `Aufnahme: ${formatTime(recordingElapsed)} / ${formatTime(MAX_RECORDING_SECONDS)}`
                : "Frage stellen…"
            }
            disabled={recording || transcribing || busy}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background/50 px-2.5 py-1.5 text-[13px] min-h-[32px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            style={{ height: "auto" }}
          />
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-rose-500 hover:bg-rose-600 text-white animate-pulse"
              title={`${formatTime(recordingElapsed)} — Stoppen`}
              aria-label="Aufnahme stoppen"
            >
              <Square size={14} className="fill-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={busy || transcribing}
              className="shrink-0 grid place-items-center w-9 h-9 rounded-lg border hover:bg-muted/60 disabled:opacity-50"
              title="Sprachnachricht"
              aria-label="Sprachnachricht aufnehmen"
            >
              <Mic size={14} />
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || busy || transcribing || recording}
            className="shrink-0 h-9 w-9 p-0"
            aria-label="Senden"
          >
            <Send size={14} />
          </Button>
        </form>
      </aside>
    </>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
