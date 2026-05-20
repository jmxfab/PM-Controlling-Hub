"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ExtractedTask {
  title: string;
  description: string;
  priority: "urgent" | "high" | "medium" | "low" | string;
  due_date: string | null;
  mail_category: string;
}

type Stage = "idle" | "recording" | "processing" | "review" | "creating";

/**
 * Sprach-zu-Aufgabe (Items 6.1-6.4).
 *
 * Pipeline:
 *   1. MediaRecorder zeichnet auf (webm/opus)
 *   2. POST /api/speech/transcribe-and-extract
 *      -> Whisper transkribiert -> Claude extrahiert Tasks
 *   3. User sieht Vorschau-Liste, kann editieren/loeschen, dann "Anlegen"
 *   4. POST /api/mail-tasks pro Task
 */
export function VoiceTaskDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    setStage("idle");
    setError(null);
    setTranscript("");
    setTasks([]);
    setElapsed(0);
    chunksRef.current = [];
  }

  function cleanupStream() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }

  useEffect(() => {
    return () => cleanupStream();
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Mime-Type-Fallback-Kette: Chrome/Firefox/Edge mögen webm/opus,
      // Safari (iOS) kann nur audio/mp4. Whisper akzeptiert beide Formate.
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
      // Wenn mime leer ist: Default des Browsers nutzen (Safari-Fallback).
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mime || rec.mimeType || "audio/webm",
        });
        cleanupStream();
        await processAudio(blob);
      };
      rec.start(1000); // 1s chunks
      setStage("recording");
      const t0 = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - t0) / 1000));
      }, 250);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Mikrofon-Zugriff verweigert: ${e.message}`
          : "Mikrofon nicht verfuegbar",
      );
      cleanupStream();
      setStage("idle");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setStage("processing");
    }
  }

  async function processAudio(blob: Blob) {
    try {
      const fd = new FormData();
      // Dateiendung anhand des MIME-Types waehlen — Whisper erkennt Format
      // ueber Extension wenn Content-Type generic ist (Safari liefert oft
      // 'audio/mp4' bei iOS-Aufnahmen).
      const ext = blob.type.includes("mp4")
        ? "mp4"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      fd.append("file", blob, `voice.${ext}`);
      const res = await fetch("/api/speech/transcribe-and-extract", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Fehler ${res.status}`);
        setStage("idle");
        return;
      }
      setTranscript(typeof json.transcript === "string" ? json.transcript : "");
      setTasks(Array.isArray(json.tasks) ? json.tasks : []);
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setStage("idle");
    }
  }

  function updateTask(i: number, patch: Partial<ExtractedTask>) {
    setTasks((arr) => arr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function removeTask(i: number) {
    setTasks((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function createAll() {
    setStage("creating");
    setError(null);
    try {
      await Promise.all(
        tasks.map((t) =>
          fetch("/api/mail-tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: t.title,
              description: t.description ?? "",
              mail_category: t.mail_category,
              priority: t.priority,
              due_date: t.due_date,
            }),
          }),
        ),
      );
      reset();
      setOpen(false);
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Anlegen");
      setStage("review");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
          cleanupStream();
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 px-2.5 sm:px-3">
          <Mic size={14} />
          <span className="hidden sm:inline">Sprachnotiz</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-xl rounded-2xl w-[calc(100vw-1rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <Mic size={18} />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Sprachnotiz zu Aufgabe
              </DialogTitle>
              <DialogDescription className="text-xs">
                Sprich z. B. „Morgen Müller anrufen wegen Angebot"
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {stage === "idle" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <button
              type="button"
              onClick={startRecording}
              className="w-24 h-24 rounded-full bg-rose-500 hover:bg-rose-600 text-white grid place-items-center shadow-lg shadow-rose-500/30 transition-all hover:scale-105"
              aria-label="Aufnahme starten"
            >
              <Mic size={36} />
            </button>
            <p className="text-sm text-muted-foreground">
              Tipp zum Aufnehmen — bis zu 2 Min am Stück
            </p>
          </div>
        )}

        {stage === "recording" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <button
              type="button"
              onClick={stopRecording}
              className="relative w-24 h-24 rounded-full bg-rose-500 text-white grid place-items-center shadow-lg shadow-rose-500/40 animate-pulse"
              aria-label="Aufnahme stoppen"
            >
              <Square size={32} className="fill-white" />
            </button>
            <p className="text-sm font-medium tabular-nums">
              {formatTime(elapsed)} — tipp zum Stoppen
            </p>
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 size={32} className="animate-spin text-rose-500" />
            <p className="text-sm text-muted-foreground">
              Transkribiere und extrahiere Aufgaben…
            </p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-4">
            {transcript && (
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Transkript
                </div>
                <p className="text-[13px] italic text-muted-foreground">
                  „{transcript}"
                </p>
              </div>
            )}
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Aufgaben erkannt. Bitte nochmal mit klarer Handlung sprechen.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {tasks.length} Aufgabe{tasks.length === 1 ? "" : "n"} erkannt
                </div>
                {tasks.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => updateTask(i, { title: e.target.value })}
                        className="flex-1 bg-transparent border-0 border-b border-border/50 focus:border-foreground focus:outline-none text-[14px] font-semibold py-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeTask(i)}
                        className="shrink-0 text-muted-foreground hover:text-rose-500 p-1"
                        title="Aufgabe verwerfen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <select
                        value={t.mail_category}
                        onChange={(e) =>
                          updateTask(i, { mail_category: e.target.value })
                        }
                        className="bg-muted rounded px-1.5 py-0.5"
                      >
                        <option value="aufgabe">Aufgabe</option>
                        <option value="kritisch">Kritisch</option>
                        <option value="dringend">Dringend</option>
                        <option value="info">Info</option>
                        <option value="rechnung">Rechnung</option>
                        <option value="bestellung">Bestellung</option>
                      </select>
                      <select
                        value={t.priority}
                        onChange={(e) =>
                          updateTask(i, { priority: e.target.value })
                        }
                        className="bg-muted rounded px-1.5 py-0.5"
                      >
                        <option value="urgent">Dringend</option>
                        <option value="high">Hoch</option>
                        <option value="medium">Mittel</option>
                        <option value="low">Niedrig</option>
                      </select>
                      <input
                        type="date"
                        value={t.due_date ?? ""}
                        onChange={(e) =>
                          updateTask(i, { due_date: e.target.value || null })
                        }
                        className="bg-muted rounded px-1.5 py-0.5"
                      />
                    </div>
                    {t.description && (
                      <textarea
                        value={t.description}
                        onChange={(e) =>
                          updateTask(i, { description: e.target.value })
                        }
                        rows={2}
                        className="w-full bg-muted/40 rounded px-2 py-1 text-[12.5px]"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={reset}>
                Verwerfen
              </Button>
              <Button
                onClick={createAll}
                disabled={tasks.length === 0}
                className="gap-1.5"
              >
                <Check size={14} />
                {tasks.length} Aufgabe{tasks.length === 1 ? "" : "n"} anlegen
              </Button>
            </div>
          </div>
        )}

        {stage === "creating" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 size={28} className="animate-spin text-rose-500" />
            <p className="text-sm text-muted-foreground">Aufgaben anlegen…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
