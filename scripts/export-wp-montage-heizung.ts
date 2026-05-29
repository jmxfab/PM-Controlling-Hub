/**
 * Einmaliger Export: Alle Projekte mit "WP Montage Heizung" Terminen ab Juni 2026
 *
 * Ausführen:
 *   HERO_API_KEY=<key> NEXT_PUBLIC_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx tsx scripts/export-wp-montage-heizung.ts
 *
 * Ausgabe: wp-montage-heizung-export.csv im Projektverzeichnis
 */

import * as fs from "fs";
import * as path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { heroGraphQL } from "./sync/hero-gql";

function getSupabaseClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL/Key fehlt in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Schritt 1: Hero Schema introspektieren um FieldService_Job Felder zu finden
// ---------------------------------------------------------------------------

interface IntrospectField {
  name: string;
  type: { name: string | null; kind: string };
}

async function introspectFieldServiceJob(): Promise<string[]> {
  const result = await heroGraphQL<{
    __type: { name: string; fields: IntrospectField[] } | null;
  }>(`
    query IntrospectFSJ {
      __type(name: "FieldService_Job") {
        name
        fields {
          name
          type { name kind }
        }
      }
    }
  `);

  const fields = result.__type?.fields ?? [];
  console.log(
    "FieldService_Job Felder:",
    fields.map((f) => f.name).join(", ")
  );
  return fields.map((f) => f.name);
}

// ---------------------------------------------------------------------------
// Schritt 2: Passende Felder für den Export-Query zusammenbauen
// ---------------------------------------------------------------------------

const SCALAR_FIELDS = new Set([
  "id", "created", "modified", "title", "name", "description", "subject",
  "start", "end", "date", "planned_date",
  "project_match_id", "customer_id",
  "is_done", "done", "status", "status_code",
  "duration", "duration_minutes",
  "type", "category", "job_type",
]);

function buildSelectionSet(availableFields: string[]): string {
  const scalars = availableFields.filter((f) => SCALAR_FIELDS.has(f));
  const parts: string[] = scalars.length > 0 ? scalars : ["id", "created", "modified"];

  // Ggf. category-Objekt expandieren
  if (availableFields.includes("category")) {
    const idx = parts.indexOf("category");
    if (idx !== -1) parts[idx] = "category { id name }";
  }
  // partners-Array expandieren
  if (availableFields.includes("partners")) {
    parts.push("partners { id first_name last_name email }");
  }

  return parts.join("\n        ");
}

// ---------------------------------------------------------------------------
// Schritt 3: Alle field_service_jobs paginiert laden
// ---------------------------------------------------------------------------

interface RawJob {
  id: string | number;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  subject?: string | null;
  start?: string | null;
  end?: string | null;
  planned_date?: string | null;
  date?: string | null;
  project_match_id?: string | number | null;
  customer_id?: string | number | null;
  is_done?: boolean | null;
  done?: boolean | null;
  status?: string | null;
  status_code?: string | null;
  partners?: Array<{ id: string; first_name?: string; last_name?: string; email?: string }> | null;
  [key: string]: unknown;
}

async function fetchAllFieldServiceJobs(selectionSet: string): Promise<RawJob[]> {
  const PAGE_SIZE = 200;
  let offset = 0;
  const all: RawJob[] = [];

  console.log("Lade field_service_jobs von Hero API...");

  while (true) {
    const result = await heroGraphQL<{ field_service_jobs: RawJob[] }>(`
      query ExportFSJ($first: Int!, $offset: Int!) {
        field_service_jobs(first: $first, offset: $offset, orderBy: "id") {
          ${selectionSet}
        }
      }
    `, { first: PAGE_SIZE, offset });

    const page = result.field_service_jobs ?? [];
    all.push(...page);
    console.log(`  → ${all.length} Datensätze geladen (Seite: ${page.length})`);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Schritt 4: Titel ermitteln + filtern
// ---------------------------------------------------------------------------

function getJobTitle(job: RawJob): string {
  return (job.title ?? job.name ?? job.description ?? job.subject ?? "").trim();
}

function getJobDate(job: RawJob): string {
  return (job.start ?? job.planned_date ?? job.date ?? "").slice(0, 10);
}

const TITLE_PATTERN = /wp.{0,5}montage.{0,5}heizung/i;
const FROM_DATE = "2026-06-01";

function matchesFilter(job: RawJob): boolean {
  const title = getJobTitle(job);
  const dateStr = getJobDate(job);
  if (!TITLE_PATTERN.test(title)) return false;
  if (!dateStr) return false;
  return dateStr >= FROM_DATE;
}

// ---------------------------------------------------------------------------
// Schritt 5: Projektdaten aus Supabase laden
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  project_number: string | null;
  project_name: string | null;
  department: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  current_status: string | null;
  measure_name: string | null;
}

async function loadProjectsByIds(ids: string[]): Promise<Map<string, ProjectRow>> {
  if (ids.length === 0) return new Map();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("hero_projects")
    .select("id, project_number, project_name, department, customer_name, customer_email, customer_phone, customer_address, current_status, measure_name")
    .in("id", ids);

  if (error) throw new Error(`Supabase Fehler: ${error.message}`);
  const map = new Map<string, ProjectRow>();
  for (const row of data ?? []) {
    map.set(row.id, row as ProjectRow);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Schritt 6: CSV exportieren
// ---------------------------------------------------------------------------

function escapeCsv(val: string | null | undefined): string {
  const s = (val ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function exportCsv(rows: Array<{
  job: RawJob;
  project: ProjectRow | undefined;
}>): string {
  const headers = [
    "Termin-ID", "Termin-Titel", "Datum", "Status",
    "Projektnummer", "Projektname", "Abteilung", "Maßnahme", "Projektstatus",
    "Kundenname", "E-Mail", "Telefon", "Adresse",
    "Monteure",
  ];

  const lines = [headers.map(escapeCsv).join(";")];

  for (const { job, project } of rows) {
    const monteure = (job.partners ?? [])
      .map((p) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim())
      .filter(Boolean)
      .join(", ");

    lines.push([
      escapeCsv(String(job.id)),
      escapeCsv(getJobTitle(job)),
      escapeCsv(getJobDate(job)),
      escapeCsv(job.status ?? job.status_code ?? null),
      escapeCsv(project?.project_number),
      escapeCsv(project?.project_name),
      escapeCsv(project?.department),
      escapeCsv(project?.measure_name),
      escapeCsv(project?.current_status),
      escapeCsv(project?.customer_name),
      escapeCsv(project?.customer_email),
      escapeCsv(project?.customer_phone),
      escapeCsv(project?.customer_address),
      escapeCsv(monteure),
    ].join(";"));
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== WP Montage Heizung Export ===\n");

  // 1. Introspection
  let availableFields: string[];
  try {
    availableFields = await introspectFieldServiceJob();
  } catch (e) {
    console.warn("Introspection fehlgeschlagen, nutze Standard-Felder:", e);
    availableFields = ["id", "created", "modified", "title", "start", "project_match_id", "partners", "status", "is_done"];
  }

  // 2. Query bauen
  const selectionSet = buildSelectionSet(availableFields);
  console.log("\nNutze Selection Set:\n", selectionSet, "\n");

  // 3. Alle Jobs laden
  const allJobs = await fetchAllFieldServiceJobs(selectionSet);
  console.log(`\nGesamt geladen: ${allJobs.length} field_service_jobs`);

  // 4. Filtern
  const matching = allJobs.filter(matchesFilter);
  console.log(`\nGefiltert (WP Montage Heizung ab ${FROM_DATE}): ${matching.length} Treffer`);

  if (matching.length === 0) {
    // Zeige vorhandene Titel-Varianten für Debugging
    const wpTitles = allJobs
      .filter((j) => {
        const t = getJobTitle(j).toLowerCase();
        return t.includes("wp") || t.includes("heizung") || t.includes("wärmepumpe");
      })
      .map((j) => getJobTitle(j))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 30);

    console.log("\nVorhandene WP/Heizung-Titel zur Orientierung:");
    wpTitles.forEach((t) => console.log(" -", t));
    console.log("\nKeine passenden Termine gefunden. Bitte Titelmuster prüfen.");
    return;
  }

  // 5. Projektdaten laden
  const projectIds = [...new Set(
    matching
      .map((j) => j.project_match_id)
      .filter(Boolean)
      .map(String)
  )];
  console.log(`Lade ${projectIds.length} Projekte aus Supabase...`);
  const projectMap = await loadProjectsByIds(projectIds);

  // 6. CSV schreiben
  const rows = matching.map((job) => ({
    job,
    project: job.project_match_id ? projectMap.get(String(job.project_match_id)) : undefined,
  }));

  const csv = exportCsv(rows);
  const outPath = path.join(process.cwd(), "wp-montage-heizung-export.csv");
  fs.writeFileSync(outPath, "﻿" + csv, "utf-8"); // BOM für Excel

  console.log(`\n✓ Export gespeichert: ${outPath}`);
  console.log(`  ${matching.length} Zeilen, ${projectIds.length} Projekte`);
}

main().catch((err) => {
  console.error("Fehler:", err);
  process.exit(1);
});
