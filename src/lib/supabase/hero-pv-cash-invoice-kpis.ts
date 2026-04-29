import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cleanProjectTitle } from "@/lib/hero/project-title";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * KPI-Reihe im Cash-Tab unter Sparte PV — drei Rechnungs-zentrische
 * Counts mit Überlappung (eine Rechnung kann in mehrere Töpfe fallen):
 *
 * 1. Offen + nicht überfällig (versendet im Zeitraum, ≤7 Tage seit document_date)
 * 2. Offen + überfällig (versendet im Zeitraum, >7 Tage seit document_date)
 * 3. Offen + im aktiven Step (Zählermontage / Nacharbeiten AC|DC|terminiert)
 *
 * Filter:
 *  - type='invoice' (reversal_invoice ausgeschlossen)
 *  - status_code=200 (Versendet)
 *  - is_deleted=false
 *  - Projekt-department_key='PV'
 *  - document_date in [from, to)
 */

export interface PvCashInvoiceRow {
  id: string;
  nr: string | null;
  documentDate: string | null;
  value: number | null;
  statusName: string | null;
  documentTypeName: string | null;
  fileUrl: string | null;
  projectId: string | null;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  ageDays: number;
  isOverdue: boolean;
  isInActiveStep: boolean;
}

export interface PvCashInvoiceKpis {
  total: { count: number; rows: PvCashInvoiceRow[] };
  notOverdue: { count: number; rows: PvCashInvoiceRow[] };
  overdue: { count: number; rows: PvCashInvoiceRow[] };
  inActiveStep: { count: number; rows: PvCashInvoiceRow[] };
  /** Liste der Step-Patterns (kleingeschrieben, includes-Match) — fuer
   *  die UI-Beschreibung. */
  activeStepLabels: string[];
}

/** Kleingeschriebene Substring-Patterns gegen step_name.toLowerCase() */
export const PV_INVOICE_STEP_PATTERNS = [
  "zählermontage",
  "nacharbeiten ac",
  "nacharbeiten dc",
  "nacharbeiten terminiert",
];

/** Kleingeschriebene Substring-Patterns gegen step_name.toLowerCase() */
export const WP_INVOICE_STEP_PATTERNS = [
  "nacharbeiten nicht terminiert",
  "nacharbeiten montage",
];

const PAYMENT_DUE_DAYS = 7;

/**
 * Kompatibilitäts-Wrapper für PV. Nutzt intern loadCashInvoiceKpisForDept.
 */
export async function loadPvCashInvoiceKpis(
  fromIso: string,
  toIso: string
): Promise<PvCashInvoiceKpis> {
  return loadCashInvoiceKpisForDept(
    "PV",
    PV_INVOICE_STEP_PATTERNS,
    fromIso,
    toIso
  );
}

export async function loadCashInvoiceKpisForDept(
  department: "PV" | "WP",
  stepPatterns: string[],
  fromIso: string,
  toIso: string
): Promise<PvCashInvoiceKpis> {
  const supabase = supabaseAdmin();

  // Schritt 1: Projekte der Sparte laden (id + step_name + customer/projekt-info)
  const { data: pvProjects } = await supabase
    .from("hero_dashboard_projects")
    .select(
      "id, step_name, project_number, project_name, customer_name"
    )
    .eq("department_key", department)
    .limit(5000);

  type PvProject = {
    id: string;
    step_name: string | null;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
  };

  const pvMap = new Map<string, PvProject>();
  for (const p of (pvProjects ?? []) as PvProject[]) {
    pvMap.set(p.id, p);
  }

  if (pvMap.size === 0) {
    return emptyKpis();
  }

  // Schritt 2: Rechnungen filtern. raw nehmen wir mit damit wir an die
  // file_upload.url für den PDF-Direktlink rankommen. document_type_name
  // enthält die fachliche Klassifikation (Teilrechnung / Abschlussrechnung
  // / Kundenrechnung).
  const { data: invoices } = await supabase
    .from("hero_customer_documents")
    .select(
      "id, nr, document_date, value, status_code, status_name, document_type_name, project_match_id, raw"
    )
    .eq("type", "invoice")
    .eq("is_deleted", false)
    .eq("status_code", 200)
    .gte("document_date", fromIso)
    .lt("document_date", toIso)
    .in("project_match_id", [...pvMap.keys()])
    .limit(5000);

  type Invoice = {
    id: string;
    nr: string | null;
    document_date: string | null;
    value: number | string | null;
    status_code: number | null;
    status_name: string | null;
    document_type_name: string | null;
    project_match_id: string | null;
    raw: Record<string, unknown> | null;
  };

  const now = Date.now();
  const allRows: PvCashInvoiceRow[] = [];

  for (const inv of (invoices ?? []) as Invoice[]) {
    const project = inv.project_match_id ? pvMap.get(inv.project_match_id) : undefined;
    if (!project) continue;
    const docTs = inv.document_date ? Date.parse(inv.document_date) : NaN;
    const ageMs = Number.isFinite(docTs) ? now - docTs : 0;
    // Volle Tage (abgerundet) seit Rechnungsdatum. Day 0 = heute versendet,
    // Day 7 = genau eine Woche her, Day 8 = mehr als eine Woche her.
    const ageDays = Math.max(0, Math.floor(ageMs / 86400000));
    // Strikt größer als die Zahlungsfrist. Day 7 ist NOCH nicht überfällig,
    // erst ab Day 8.
    const isOverdue = Number.isFinite(docTs) && ageDays > PAYMENT_DUE_DAYS;
    const stepLower = (project.step_name ?? "").toLowerCase();
    const isInActiveStep = stepPatterns.some((p) => stepLower.includes(p));

    const fileUpload = (inv.raw as Record<string, unknown> | null)?.[
      "file_upload"
    ] as Record<string, unknown> | undefined;
    const fileUrl =
      typeof fileUpload?.["url"] === "string"
        ? (fileUpload["url"] as string)
        : null;

    allRows.push({
      id: inv.id,
      nr: inv.nr,
      documentDate: inv.document_date,
      value:
        inv.value === null
          ? null
          : typeof inv.value === "number"
            ? inv.value
            : Number(inv.value) || null,
      statusName: inv.status_name,
      documentTypeName: inv.document_type_name,
      fileUrl,
      projectId: inv.project_match_id,
      projectNumber: project.project_number,
      projectName: cleanProjectTitle(project.project_name, {
        customerName: project.customer_name,
        projectNumber: project.project_number,
      }),
      customerName: project.customer_name,
      stepName: project.step_name,
      ageDays,
      isOverdue,
      isInActiveStep,
    });
  }

  const notOverdueRows = allRows.filter((r) => !r.isOverdue);
  const overdueRows = allRows.filter((r) => r.isOverdue);
  const stepRows = allRows.filter((r) => r.isInActiveStep);

  return {
    total: { count: allRows.length, rows: allRows },
    notOverdue: { count: notOverdueRows.length, rows: notOverdueRows },
    overdue: { count: overdueRows.length, rows: overdueRows },
    inActiveStep: { count: stepRows.length, rows: stepRows },
    activeStepLabels: stepPatterns.slice(),
  };
}

function emptyKpis(): PvCashInvoiceKpis {
  return {
    total: { count: 0, rows: [] },
    notOverdue: { count: 0, rows: [] },
    overdue: { count: 0, rows: [] },
    inActiveStep: { count: 0, rows: [] },
    activeStepLabels: [],
  };
}
