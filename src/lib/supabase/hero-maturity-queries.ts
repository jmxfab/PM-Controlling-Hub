import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  GESAMT_DEPARTMENT_KEYS_ARR,
  type Department,
  type ProjectDepartment,
} from "@/lib/dashboard/dashboard-types";
import { cleanProjectTitle } from "@/lib/hero/project-title";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase creds");
  return createClient(url, key);
}

export interface UpcomingProject {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  stepName: string | null;
  statusName: string | null;
  statusCode: number | null;
  previousStepName: string | null;
  maturityDate: string | null;
  createdAtHero: string | null;
  department: ProjectDepartment | null;
  isOverdue: boolean;
  daysUntilDue: number;
  wasReopened: boolean;
  confirmation: UpcomingConfirmation | null;
  documents: UpcomingDocument[];
}

export interface UpcomingConfirmation {
  id: string;
  nr: string | null;
  fileUrl: string | null;
  documentTypeName: string | null;
  statusName: string | null;
  /** True wenn die AB als 'Erstellt (Hochgeladen)' im Hero liegt — das ist
   *  Heros Konvention für eine vom Kunden zurückgegebene Datei. */
  isSignedScan: boolean;
  documentDate: string | null;
}

export interface UpcomingDocument {
  id: string;
  nr: string | null;
  fileUrl: string | null;
  type: string | null;
  documentTypeName: string | null;
  statusName: string | null;
  documentDate: string | null;
  value: number | null;
}

/**
 * Projekte deren maturity_date in einem Zeitfenster liegt — sortiert nach
 * Fälligkeit (überfällig und heute zuerst). Für die Planungsansicht.
 */
export const loadUpcomingProjects = cache(
  async (
    department: Department,
    fromIso: string,
    toIso: string
  ): Promise<UpcomingProject[]> => {
    const supabase = supabaseAdmin();

    let query = supabase
      .from("hero_dashboard_projects")
      .select(
        "id, project_number, project_name, customer_name, customer_email, customer_phone, customer_address, step_name, status_name, status_code, previous_step_name, maturity_date, created_at_hero, was_reopened, department_key, is_finished"
      )
      .eq("is_finished", false)
      .not("maturity_date", "is", null)
      .gte("maturity_date", fromIso)
      .lt("maturity_date", toIso);

    // GESAMT = nur PV+WP. Bug-Fix: vorher hat dieser Block fuer GESAMT
    // .in("department_key", typeIds) gemacht — typeIds waren aber die
    // numerischen Hero-Type-IDs ("36933","36934",...), nicht die
    // String-Department-Keys ("PV","WP"). Ergebnis: GESAMT lieferte 0
    // Projekte zurueck weil department_key niemals zu einer numerischen
    // type_id matched. Jetzt korrekt mit GESAMT_DEPARTMENT_KEYS_ARR.
    if (department !== "GESAMT") {
      query = query.eq("department_key", department);
    } else {
      query = query.in("department_key", GESAMT_DEPARTMENT_KEYS_ARR);
    }

    const { data, error } = await query
      .order("maturity_date", { ascending: true })
      .limit(500);

    if (error) {
      console.error("loadUpcomingProjects query failed:", error.message);
      return [];
    }

    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    const rows = (data ?? []) as Array<{
      id: string;
      project_number: string | null;
      project_name: string | null;
      customer_name: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      customer_address: string | null;
      step_name: string | null;
      status_name: string | null;
      status_code: number | null;
      previous_step_name: string | null;
      maturity_date: string | null;
      created_at_hero: string | null;
      was_reopened: boolean | null;
      department_key: string | null;
    }>;

    // Auftragsbestätigungen + alle relevanten Dokumente pro Projekt batched holen.
    const projectIds = rows.map((r) => r.id);
    const [confirmationByProject, documentsByProject] = await Promise.all([
      loadConfirmationsForProjects(supabase, projectIds),
      loadDocumentsForProjects(supabase, projectIds),
    ]);

    return rows.map((r) => {
      const dueTs = r.maturity_date ? Date.parse(r.maturity_date) : null;
      const isOverdue = dueTs != null && dueTs < now;
      const daysUntilDue =
        dueTs != null ? Math.round((dueTs - todayTs) / 86400000) : 0;
      return {
        id: r.id,
        projectNumber: r.project_number,
        projectName: cleanProjectTitle(r.project_name, {
          customerName: r.customer_name,
          projectNumber: r.project_number,
        }),
        customerName: r.customer_name,
        customerEmail: r.customer_email,
        customerPhone: r.customer_phone,
        customerAddress: r.customer_address,
        stepName: r.step_name,
        statusName: r.status_name,
        statusCode: r.status_code,
        previousStepName: r.previous_step_name,
        maturityDate: r.maturity_date,
        createdAtHero: r.created_at_hero,
        department: (r.department_key ?? null) as ProjectDepartment | null,
        isOverdue,
        daysUntilDue,
        wasReopened: r.was_reopened === true,
        confirmation: confirmationByProject.get(r.id) ?? null,
        documents: documentsByProject.get(r.id) ?? [],
      };
    });
  }
);

/**
 * Alle relevanten Dokumente pro Projekt — Rechnungen, ABs, Angebote,
 * Mahnungen, Storno (status_code != 1000 = nicht gelöscht). Pro Projekt
 * neueste zuerst, max 10 Stück.
 */
async function loadDocumentsForProjects(
  supabase: ReturnType<typeof supabaseAdmin>,
  projectIds: string[]
): Promise<Map<string, UpcomingDocument[]>> {
  const result = new Map<string, UpcomingDocument[]>();
  if (projectIds.length === 0) return result;

  const RELEVANT_TYPES = [
    "invoice",
    "reversal_invoice",
    "confirmation",
    "offer",
    "dunning",
    "invoice_notice",
  ];

  const { data } = await supabase
    .from("hero_customer_documents")
    .select(
      "id, nr, type, status_code, status_name, document_type_name, document_date, created_at_hero, value, project_match_id, raw"
    )
    .eq("is_deleted", false)
    .in("type", RELEVANT_TYPES)
    .in("project_match_id", projectIds)
    .neq("status_code", 1000)
    .limit(5000);

  type Row = {
    id: string;
    nr: string | null;
    type: string | null;
    status_code: number | null;
    status_name: string | null;
    document_type_name: string | null;
    document_date: string | null;
    created_at_hero: string | null;
    value: number | string | null;
    project_match_id: string | null;
    raw: Record<string, unknown> | null;
  };

  for (const row of (data ?? []) as Row[]) {
    if (!row.project_match_id) continue;
    const fileUpload = (row.raw as Record<string, unknown> | null)?.[
      "file_upload"
    ] as Record<string, unknown> | undefined;
    const fileUrl =
      typeof fileUpload?.["url"] === "string"
        ? (fileUpload["url"] as string)
        : null;
    const doc: UpcomingDocument = {
      id: row.id,
      nr: row.nr,
      fileUrl,
      type: row.type,
      documentTypeName: row.document_type_name,
      statusName: row.status_name,
      documentDate: row.document_date ?? row.created_at_hero,
      value:
        row.value === null
          ? null
          : typeof row.value === "number"
            ? row.value
            : Number(row.value) || null,
    };
    const list = result.get(row.project_match_id) ?? [];
    list.push(doc);
    result.set(row.project_match_id, list);
  }

  // Pro Projekt: nach Datum absteigend sortieren, auf 10 limitieren.
  for (const [pid, list] of result.entries()) {
    list.sort((a, b) => {
      const ta = a.documentDate ? Date.parse(a.documentDate) : 0;
      const tb = b.documentDate ? Date.parse(b.documentDate) : 0;
      return tb - ta;
    });
    result.set(pid, list.slice(0, 10));
  }

  return result;
}

/**
 * Beste Auftragsbestätigung pro Projekt: priorisiert nach
 *   1. status_name='Erstellt (Hochgeladen)'  (= signierte/zurückgegebene Datei)
 *   2. status_name='Versendet'                (an Kunde versendet)
 *   3. status_name='Erstellt'                 (vom System erstellt, draft)
 *   4. status_name='Entwurf'                  (Roh-Entwurf)
 * Bei mehreren Kandidaten gleicher Prio: das mit dem neuesten document_date /
 * created_at_hero gewinnt.
 */
async function loadConfirmationsForProjects(
  supabase: ReturnType<typeof supabaseAdmin>,
  projectIds: string[]
): Promise<Map<string, UpcomingConfirmation>> {
  const result = new Map<string, UpcomingConfirmation>();
  if (projectIds.length === 0) return result;

  const { data } = await supabase
    .from("hero_customer_documents")
    .select(
      "id, nr, status_code, status_name, document_type_name, document_date, created_at_hero, project_match_id, raw, type"
    )
    .eq("type", "confirmation")
    .eq("is_deleted", false)
    .in("status_code", [0, 100, 200])
    .in("project_match_id", projectIds)
    .limit(2000);

  type Row = {
    id: string;
    nr: string | null;
    status_code: number | null;
    status_name: string | null;
    document_type_name: string | null;
    document_date: string | null;
    created_at_hero: string | null;
    project_match_id: string | null;
    raw: Record<string, unknown> | null;
    type: string | null;
  };

  const priorityOf = (statusName: string | null): number => {
    const s = (statusName ?? "").toLowerCase();
    if (s.includes("hochgeladen")) return 4;
    if (s.includes("versendet")) return 3;
    if (s === "erstellt") return 2;
    if (s.includes("entwurf")) return 1;
    return 0;
  };

  const ts = (row: Row): number => {
    const d = row.document_date ?? row.created_at_hero;
    return d ? Date.parse(d) || 0 : 0;
  };

  const better = (a: Row, b: Row): boolean => {
    const pa = priorityOf(a.status_name);
    const pb = priorityOf(b.status_name);
    if (pa !== pb) return pa > pb;
    return ts(a) > ts(b);
  };

  const bestPerProject = new Map<string, Row>();
  for (const row of (data ?? []) as Row[]) {
    if (!row.project_match_id) continue;
    const current = bestPerProject.get(row.project_match_id);
    if (!current || better(row, current)) {
      bestPerProject.set(row.project_match_id, row);
    }
  }

  for (const [pid, row] of bestPerProject.entries()) {
    const fileUpload = (row.raw as Record<string, unknown> | null)?.[
      "file_upload"
    ] as Record<string, unknown> | undefined;
    const fileUrl =
      typeof fileUpload?.["url"] === "string" ? (fileUpload["url"] as string) : null;
    result.set(pid, {
      id: row.id,
      nr: row.nr,
      fileUrl,
      documentTypeName: row.document_type_name,
      statusName: row.status_name,
      isSignedScan: priorityOf(row.status_name) === 4,
      documentDate: row.document_date ?? row.created_at_hero,
    });
  }

  return result;
}
