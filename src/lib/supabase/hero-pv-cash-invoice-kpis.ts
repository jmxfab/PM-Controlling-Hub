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
}

const PV_INVOICE_STEP_PATTERNS = [
  "zählermontage",
  "nacharbeiten ac",
  "nacharbeiten dc",
  "nacharbeiten terminiert",
];

const PAYMENT_DUE_DAYS = 7;

export async function loadPvCashInvoiceKpis(
  fromIso: string,
  toIso: string
): Promise<PvCashInvoiceKpis> {
  const supabase = supabaseAdmin();

  // Schritt 1: PV-Projekte laden (id + step_name + customer/projekt-info)
  const { data: pvProjects } = await supabase
    .from("hero_dashboard_projects")
    .select(
      "id, step_name, project_number, project_name, customer_name"
    )
    .eq("department_key", "PV")
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

  // Schritt 2: Rechnungen filtern
  const { data: invoices } = await supabase
    .from("hero_customer_documents")
    .select(
      "id, nr, document_date, value, status_code, status_name, project_match_id"
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
    project_match_id: string | null;
  };

  const now = Date.now();
  const overdueThresholdMs = PAYMENT_DUE_DAYS * 86400000;
  const allRows: PvCashInvoiceRow[] = [];

  for (const inv of (invoices ?? []) as Invoice[]) {
    const project = inv.project_match_id ? pvMap.get(inv.project_match_id) : undefined;
    if (!project) continue;
    const docTs = inv.document_date ? Date.parse(inv.document_date) : NaN;
    const ageMs = Number.isFinite(docTs) ? now - docTs : 0;
    const ageDays = Math.max(0, Math.round(ageMs / 86400000));
    const isOverdue = Number.isFinite(docTs) && ageMs > overdueThresholdMs;
    const stepLower = (project.step_name ?? "").toLowerCase();
    const isInActiveStep = PV_INVOICE_STEP_PATTERNS.some((p) =>
      stepLower.includes(p)
    );

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
  };
}

function emptyKpis(): PvCashInvoiceKpis {
  return {
    total: { count: 0, rows: [] },
    notOverdue: { count: 0, rows: [] },
    overdue: { count: 0, rows: [] },
    inActiveStep: { count: 0, rows: [] },
  };
}
