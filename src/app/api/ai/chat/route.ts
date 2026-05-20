import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runChatWithTools, type ChatMessage, type ChatTool } from "@/lib/anthropic/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/** Hilfsfunktion: PostgREST-OR-Filter-Sanitization */
function sanitizeSearch(s: string): string {
  return s.replace(/[,()*%\\]/g, " ").trim();
}

/** Tool: Mail-Tasks durchsuchen (Title + Description). */
function buildSearchTasksTool(): ChatTool {
  return {
    name: "search_tasks",
    description:
      "Durchsucht alle Aufgaben/Tasks im Hub. Findet Mail-Aufgaben anhand von Stichwoertern in Titel oder Beschreibung. Liefert bis zu 20 Treffer mit Titel, Status, Prio, Kategorie, Eingangsdatum.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Suchbegriff (z.B. ein Name, Projektnummer, Stichwort)",
        },
        only_open: {
          type: "boolean",
          description:
            "true = nur offene Tasks (default), false = auch erledigte",
        },
      },
      required: ["query"],
    },
    async execute(input) {
      const q = sanitizeSearch(String(input.query ?? ""));
      if (!q) return "Leerer Suchbegriff.";
      const onlyOpen = input.only_open !== false;
      const supabase = supabaseAdmin();
      let query = supabase
        .from("tasks")
        .select(
          "id, title, description, mail_category, priority, status, created_at, hero_project_number, hero_project_name",
        )
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (onlyOpen) query = query.neq("status", "done");
      const { data, error } = await query;
      if (error) return `Fehler: ${error.message}`;
      if (!data || data.length === 0) return `Keine Treffer fuer "${q}".`;
      return data
        .map((t, i) => {
          const heroSuf =
            t.hero_project_number || t.hero_project_name
              ? ` · Hero: ${t.hero_project_number ?? ""} ${t.hero_project_name ?? ""}`.trim()
              : "";
          const date = t.created_at ? t.created_at.slice(0, 10) : "?";
          return `${i + 1}. [${t.status}/${t.mail_category ?? "-"}/${t.priority ?? "-"}] ${t.title} (${date})${heroSuf}\n   ${(t.description ?? "").slice(0, 200)}`;
        })
        .join("\n\n");
    },
  };
}

/** Tool: Hero-Logbuch durchsuchen. */
function buildSearchLogbuchTool(): ChatTool {
  return {
    name: "search_logbuch",
    description:
      "Durchsucht das Hero-Logbuch (Projekt-Verlauf, Notizen, Step-Wechsel). Findet Eintraege anhand von Stichwoertern. Liefert bis zu 20 Treffer mit Datum, Autor, Inhalt, Projekt.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Suchbegriff",
        },
        max_age_days: {
          type: "number",
          description: "Nur Eintraege juenger als N Tage (default 180)",
        },
      },
      required: ["query"],
    },
    async execute(input) {
      const q = sanitizeSearch(String(input.query ?? ""));
      if (!q) return "Leerer Suchbegriff.";
      const days =
        typeof input.max_age_days === "number" && input.max_age_days > 0
          ? input.max_age_days
          : 180;
      const cutoff = new Date(
        Date.now() - days * 86400_000,
      ).toISOString();
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("hero_histories")
        .select(
          "entry_date, custom_title, custom_text, description, author_name, project_match_id",
        )
        .or(
          `custom_title.ilike.%${q}%,custom_text.ilike.%${q}%,description.ilike.%${q}%`,
        )
        .eq("is_deleted", false)
        .gte("entry_date", cutoff)
        .order("entry_date", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) return `Fehler: ${error.message}`;
      if (!data || data.length === 0) return `Keine Logbuch-Treffer fuer "${q}".`;
      return data
        .map((h, i) => {
          const text = [h.custom_title, h.custom_text, h.description]
            .filter(Boolean)
            .join(" — ")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .slice(0, 300);
          const date = h.entry_date ? h.entry_date.slice(0, 10) : "?";
          return `${i + 1}. ${date} [${h.author_name ?? "?"}]: ${text}`;
        })
        .join("\n\n");
    },
  };
}

/** Tool: Hero-Projekt suchen (Number / Name / Kunde). */
function buildSearchProjectsTool(): ChatTool {
  return {
    name: "search_hero_projects",
    description:
      "Sucht Hero-Projekte anhand von Projekt-Nummer, Projekt-Name oder Kundenname. Liefert bis zu 15 Treffer mit Number/Name/Customer/Status/aktueller Step.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Projekt-Nummer, Name oder Kunde",
        },
      },
      required: ["query"],
    },
    async execute(input) {
      const q = sanitizeSearch(String(input.query ?? ""));
      if (!q) return "Leerer Suchbegriff.";
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("hero_dashboard_projects")
        .select(
          "id, project_number, project_name, customer_name, current_step_name, is_finished",
        )
        .or(
          `project_number.ilike.%${q}%,project_name.ilike.%${q}%,customer_name.ilike.%${q}%`,
        )
        .limit(15);
      if (error) return `Fehler: ${error.message}`;
      if (!data || data.length === 0) return `Keine Projekte fuer "${q}".`;
      return data
        .map((p, i) => {
          const status = p.is_finished ? "abgeschlossen" : "aktiv";
          return `${i + 1}. #${p.project_number ?? "?"} — ${p.project_name ?? "?"} · Kunde: ${p.customer_name ?? "?"} · Step: ${p.current_step_name ?? "-"} (${status})`;
        })
        .join("\n");
    },
  };
}

/** Tool: Aktuelle Mein-Tag-Liste anzeigen. */
function buildMyDayTool(): ChatTool {
  return {
    name: "get_my_day",
    description:
      "Liefert die aktuelle Mein-Tag-Liste (alle Tasks die heute angegangen werden sollen). Keine Argumente.",
    input_schema: { type: "object", properties: {} },
    async execute() {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, mail_category, priority, status, is_important, due_date")
        .or("is_automated.eq.true,is_user_created.eq.true")
        .not("in_my_day_at", "is", null)
        .neq("status", "done")
        .order("is_important", { ascending: false })
        .order("priority", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) return `Fehler: ${error.message}`;
      if (!data || data.length === 0) return "Mein Tag ist gerade leer.";
      return data
        .map(
          (t, i) =>
            `${i + 1}. ${t.is_important ? "* " : ""}[${t.priority ?? "-"}] ${t.title}${t.due_date ? ` (faellig ${t.due_date.slice(0, 10)})` : ""}`,
        )
        .join("\n");
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE-TOOLS — anlegen, aendern, erledigen
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PRIO = new Set(["urgent", "high", "medium", "low"]);
const VALID_CAT = new Set([
  "aufgabe",
  "dringend",
  "kritisch",
  "info",
  "rechnung",
  "bestellung",
  "inbox",
]);

/** Tool: Neue Aufgabe anlegen. */
function buildCreateTaskTool(): ChatTool {
  return {
    name: "create_task",
    description:
      "Legt eine neue Aufgabe an. Pflicht: title. Optional: description, priority (urgent/high/medium/low — default medium), mail_category (aufgabe/dringend/kritisch/info/rechnung/bestellung — default aufgabe), due_date (YYYY-MM-DD), assigned_to (Name oder Email), in_my_day (true=direkt in Mein Tag), is_important (Wichtig-Star).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Kurzer Aufgabentitel (Pflicht)" },
        description: { type: "string" },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
        },
        mail_category: {
          type: "string",
          enum: ["aufgabe", "dringend", "kritisch", "info", "rechnung", "bestellung"],
        },
        due_date: {
          type: "string",
          description: "ISO-Datum YYYY-MM-DD",
        },
        assigned_to: { type: "string" },
        in_my_day: { type: "boolean" },
        is_important: { type: "boolean" },
      },
      required: ["title"],
    },
    async execute(input) {
      const title = String(input.title ?? "").trim().slice(0, 200);
      if (!title) return "Fehler: title leer.";
      const priority = VALID_PRIO.has(String(input.priority))
        ? String(input.priority)
        : "medium";
      const mail_category = VALID_CAT.has(String(input.mail_category))
        ? String(input.mail_category)
        : "aufgabe";
      const due_date =
        typeof input.due_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(input.due_date)
          ? input.due_date
          : null;
      const supabase = supabaseAdmin();
      const row: Record<string, unknown> = {
        title,
        description:
          typeof input.description === "string"
            ? input.description.slice(0, 4000)
            : "",
        priority,
        mail_category,
        status: "open",
        is_user_created: true,
        is_automated: false,
      };
      if (due_date) row.due_date = due_date;
      if (typeof input.assigned_to === "string" && input.assigned_to.trim()) {
        row.assigned_to = input.assigned_to.trim().slice(0, 200);
      }
      if (input.in_my_day === true) row.in_my_day_at = new Date().toISOString();
      if (input.is_important === true) row.is_important = true;
      const { data, error } = await supabase
        .from("tasks")
        .insert(row)
        .select("id, title")
        .single();
      if (error) return `Fehler: ${error.message}`;
      return `Aufgabe angelegt — "${data?.title}" (id ${data?.id})${input.in_my_day ? " · in Mein Tag" : ""}.`;
    },
  };
}

/** Tool: Task-ID auflösen anhand Titel/Suche (Helper für die Update-Tools). */
async function resolveTaskId(
  supabase: ReturnType<typeof supabaseAdmin>,
  identifier: string,
): Promise<{ id: string; title: string } | string> {
  const id = identifier.trim();
  if (!id) return "Leere ID/Suche.";
  // UUID-Match → direkt nehmen
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("id", id)
      .single();
    if (data) return { id: data.id, title: data.title };
    return `Keine Aufgabe mit ID ${id}.`;
  }
  // Sonst ILIKE-Suche
  const safe = id.replace(/[,()*%\\]/g, " ").trim();
  const { data } = await supabase
    .from("tasks")
    .select("id, title")
    .ilike("title", `%${safe}%`)
    .neq("status", "done")
    .limit(5);
  if (!data || data.length === 0)
    return `Keine offene Aufgabe gefunden fuer "${safe}".`;
  if (data.length > 1) {
    return `Mehrdeutig (${data.length} Treffer): ${data.map((t) => `"${t.title}" (id ${t.id})`).join(", ")}. Bitte praeziser oder ID nennen.`;
  }
  return { id: data[0].id, title: data[0].title };
}

/** Tool: Task als erledigt markieren. */
function buildMarkDoneTool(): ChatTool {
  return {
    name: "mark_task_done",
    description:
      "Markiert eine Aufgabe als erledigt. Identifier kann eine Task-UUID sein ODER ein Titel-Stichwort (sucht dann offen).",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Task-ID oder Titel-Stichwort" },
      },
      required: ["identifier"],
    },
    async execute(input) {
      const supabase = supabaseAdmin();
      const lookup = await resolveTaskId(supabase, String(input.identifier ?? ""));
      if (typeof lookup === "string") return lookup;
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", lookup.id);
      if (error) return `Fehler: ${error.message}`;
      return `Erledigt: "${lookup.title}".`;
    },
  };
}

/** Tool: Task in Mein Tag verschieben (oder rausnehmen). */
function buildToggleMyDayTool(): ChatTool {
  return {
    name: "set_my_day",
    description:
      "Setzt eine Aufgabe in Mein Tag (in_my_day=true) oder entfernt sie daraus (in_my_day=false).",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        in_my_day: { type: "boolean" },
      },
      required: ["identifier", "in_my_day"],
    },
    async execute(input) {
      const supabase = supabaseAdmin();
      const lookup = await resolveTaskId(supabase, String(input.identifier ?? ""));
      if (typeof lookup === "string") return lookup;
      const adding = input.in_my_day === true;
      const { error } = await supabase
        .from("tasks")
        .update({
          in_my_day_at: adding ? new Date().toISOString() : null,
        })
        .eq("id", lookup.id);
      if (error) return `Fehler: ${error.message}`;
      return `"${lookup.title}" ${adding ? "in Mein Tag verschoben" : "aus Mein Tag entfernt"}.`;
    },
  };
}

/** Tool: Prio einer Task setzen. */
function buildSetPriorityTool(): ChatTool {
  return {
    name: "set_task_priority",
    description:
      "Aendert die Prioritaet einer Aufgabe (urgent/high/medium/low).",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
        },
      },
      required: ["identifier", "priority"],
    },
    async execute(input) {
      const priority = String(input.priority);
      if (!VALID_PRIO.has(priority)) return `Ungueltige Prio: ${priority}`;
      const supabase = supabaseAdmin();
      const lookup = await resolveTaskId(supabase, String(input.identifier ?? ""));
      if (typeof lookup === "string") return lookup;
      const { error } = await supabase
        .from("tasks")
        .update({ priority })
        .eq("id", lookup.id);
      if (error) return `Fehler: ${error.message}`;
      return `Prio auf "${priority}" gesetzt fuer "${lookup.title}".`;
    },
  };
}

/** Tool: Wichtig-Star toggeln. */
function buildSetImportantTool(): ChatTool {
  return {
    name: "set_task_important",
    description: "Setzt oder entfernt den Wichtig-Star (is_important) einer Aufgabe.",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        is_important: { type: "boolean" },
      },
      required: ["identifier", "is_important"],
    },
    async execute(input) {
      const supabase = supabaseAdmin();
      const lookup = await resolveTaskId(supabase, String(input.identifier ?? ""));
      if (typeof lookup === "string") return lookup;
      const flag = input.is_important === true;
      const { error } = await supabase
        .from("tasks")
        .update({ is_important: flag })
        .eq("id", lookup.id);
      if (error) return `Fehler: ${error.message}`;
      return `"${lookup.title}" ${flag ? "als wichtig markiert" : "Wichtig-Markierung entfernt"}.`;
    },
  };
}

const SYSTEM_PROMPT = `Du bist der Assistent fuer den Jumax Controlling-Hub. Du hast Tools zum Durchsuchen UND Bearbeiten von Aufgaben, Hero-Projekten und Logbuch-Eintraegen.

Verhalten:
- Antworte praezise und auf Deutsch (du-Form).
- Wenn der User nach etwas fragt das in der Datenbank stehen koennte: NUTZE die Such-Tools statt zu raten.
- Wenn der User AKTIONEN will (Aufgabe anlegen, erledigt setzen, Mein Tag, Prio aendern, Wichtig markieren): NUTZE die entsprechenden Write-Tools.
- Bei Erstellung mit Datum: relative Angaben wie "morgen", "Freitag", "naechste Woche" in absolutes ISO-Datum umwandeln (heute ist ${new Date().toISOString().slice(0, 10)}).
- Bei Update-Tools: wenn der User nur Stichwort/Teil-Titel nennt, gibst du das als identifier — das Tool sucht selbst. Bei Mehrdeutigkeit (>1 Treffer) NACHFRAGEN statt raten.
- Fasse Such-Ergebnisse zusammen — kopier nicht stumpf alle Treffer. Hebe das Wichtigste hervor.
- Mehrere Tools kombinieren ist ok (z.B. erst suchen, dann updaten).
- Kurze Antworten bevorzugt. Lange Liste nur wenn explizit gefragt.
- Nach erfolgreichen Aktionen kurz BESTAETIGEN was passiert ist.`;

/**
 * POST /api/ai/chat
 * Body: { messages: [{role, content}, ...] }
 * Response: { reply, toolCalls: [{name, input, result}, ...] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      messages?: ChatMessage[];
    };
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(
          (m): m is ChatMessage =>
            !!m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
      : [];
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "messages: leeres Array" },
        { status: 400 },
      );
    }
    const tools: ChatTool[] = [
      // READ
      buildSearchTasksTool(),
      buildSearchLogbuchTool(),
      buildSearchProjectsTool(),
      buildMyDayTool(),
      // WRITE
      buildCreateTaskTool(),
      buildMarkDoneTool(),
      buildToggleMyDayTool(),
      buildSetPriorityTool(),
      buildSetImportantTool(),
    ];
    const result = await runChatWithTools({
      system: SYSTEM_PROMPT,
      messages,
      tools,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
