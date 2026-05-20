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

const SYSTEM_PROMPT = `Du bist der Assistent fuer den Jumax Controlling-Hub. Du hast Tools zum Durchsuchen von Aufgaben, Hero-Projekten und Logbuch-Eintraegen.

Verhalten:
- Antworte praezise und auf Deutsch (du-Form).
- Wenn der User nach etwas fragt das in der Datenbank stehen koennte: NUTZE die Tools statt zu raten.
- Fasse Tool-Ergebnisse zusammen — kopier nicht stumpf alle Treffer. Hebe das Wichtigste hervor.
- Wenn die Suche nichts liefert: sag es klar. Nicht halluzinieren.
- Mehrere Tools kombinieren ist ok (z.B. Projekt suchen, dann Logbuch dazu).
- Kurze Antworten bevorzugt. Lange Liste nur wenn explizit gefragt.`;

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
      buildSearchTasksTool(),
      buildSearchLogbuchTool(),
      buildSearchProjectsTool(),
      buildMyDayTool(),
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
