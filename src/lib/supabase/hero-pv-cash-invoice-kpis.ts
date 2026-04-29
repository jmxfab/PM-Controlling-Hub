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
  /** Heuristisch abgeleiteter Typ aus Position der Rechnung im Projekt
   *  + aktueller Step. Beispiele: "1. Teilrechnung", "2. Teilrechnung",
   *  "Abschlussrechnung". Fallback auf documentTypeName wenn keine
   *  Heuristik greift. */
  derivedType: string;
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

/** Steps die nach der Abschlussrechnung kommen (PV/WP). Wenn ein
 *  Projekt aktuell in einem dieser Steps oder im Abschluss-Step selbst
 *  steht, ist die LETZTE versendete Rechnung typischerweise die
 *  Abschlussrechnung. Earlier sent invoices waren dann Teilrechnungen. */
const POST_OR_IN_ABSCHLUSS_STEP_PATTERNS = [
  "abschlussrechnung",
  "schlussrechnung",
  "kundenrechnung",
  // PV — nach Abschlussrechnung
  "zählermontage",
  "nacharbeiten ac",
  "nacharbeiten dc",
  "nacharbeiten terminiert",
  // WP — nach Abschlussrechnung
  "nacharbeiten nicht terminiert",
  "nacharbeiten montage",
  // Allgemein abgeschlossen / Bewertung
  "abgeschlossen",
  "archiviert",
  "fertig",
  "bewertungspool",
];

function isInOrPastAbschluss(stepName: string | null): boolean {
  const lower = (stepName ?? "").toLowerCase();
  if (!lower) return false;
  return POST_OR_IN_ABSCHLUSS_STEP_PATTERNS.some((p) => lower.includes(p));
}

/** Aus Position + Projekt-Step den Rechnungs-Typ ableiten:
 *  - Wenn dies die LETZTE Rechnung des Projekts ist UND das Projekt im
 *    oder nach dem Abschluss-Step steht → "Abschlussrechnung"
 *  - Sonst → "${pos}. Teilrechnung" */
function deriveInvoiceType(
  pos1Indexed: number,
  totalInvoicesOfProject: number,
  projectStepName: string | null,
  fallback: string | null
): string {
  if (pos1Indexed < 1 || totalInvoicesOfProject < 1) {
    return fallback ?? "Rechnung";
  }
  const isLast = pos1Indexed === totalInvoicesOfProject;
  if (isLast && isInOrPastAbschluss(projectStepName)) {
    return "Abschlussrechnung";
  }
  return `${pos1Indexed}. Teilrechnung`;
}

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
  department: "PV" | "WP" | "GESAMT",
  stepPatterns: string[],
  fromIso: string,
  toIso: string
): Promise<PvCashInvoiceKpis> {
  const supabase = supabaseAdmin();

  // Schritt 1: ALLE versendeten Rechnungen im Zeitraum laden (kleines
  // Set, gefiltert via type/status/date). Sparten-Filter kommt erst beim
  // Projekt-Lookup. Wichtig fuer GESAMT — sonst muessten wir 5000+ Projekt-
  // IDs in der URL-IN-Clause uebergeben, was die PostgREST-URL-Grenze
  // sprengt.
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

  const invoiceList = (invoices ?? []) as Invoice[];
  const projectIds = [
    ...new Set(
      invoiceList
        .map((i) => i.project_match_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (projectIds.length === 0) {
    return emptyKpis();
  }

  // Schritt 2: Projekt-Info zu den Rechnungs-IDs laden. Bei PV/WP wird
  // zusaetzlich nach department_key gefiltert — Rechnungen anderer Sparten
  // landen dann nicht im pvMap und werden ignoriert. Bei GESAMT keine
  // Sparten-Einschraenkung.
  type PvProject = {
    id: string;
    step_name: string | null;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
  };

  let projectQuery = supabase
    .from("hero_dashboard_projects")
    .select("id, step_name, project_number, project_name, customer_name")
    .in("id", projectIds);
  if (department !== "GESAMT") {
    projectQuery = projectQuery.eq("department_key", department);
  }
  const { data: pvProjects } = await projectQuery.limit(5000);

  const pvMap = new Map<string, PvProject>();
  for (const p of (pvProjects ?? []) as PvProject[]) {
    pvMap.set(p.id, p);
  }

  if (pvMap.size === 0) {
    return emptyKpis();
  }

  // Schritt 3: ALLE Rechnungen dieser Projekte laden (auch ausserhalb des
  // Zeitraums, status=200 OR 100 OR 600 — also alle ausser Entwurf/Geloescht).
  // Wir brauchen das um die Position jeder Rechnung im Projekt zu bestimmen
  // ("ist das die 1. Teilrechnung oder die Abschlussrechnung?").
  const { data: projectInvoices } = await supabase
    .from("hero_customer_documents")
    .select("id, project_match_id, document_date, status_code")
    .eq("type", "invoice")
    .eq("is_deleted", false)
    .in("status_code", [100, 200, 600])
    .in("project_match_id", [...pvMap.keys()])
    .limit(20000);

  type ProjectInvoiceRef = {
    id: string;
    project_match_id: string | null;
    document_date: string | null;
    status_code: number | null;
  };

  const projectInvoiceMap = new Map<string, ProjectInvoiceRef[]>();
  for (const pi of (projectInvoices ?? []) as ProjectInvoiceRef[]) {
    if (!pi.project_match_id) continue;
    // Stornorechnungen (600) zaehlen nicht als eigene Position — sie
    // korrigieren eine bestehende Rechnung. Wir nehmen sie nur mit damit
    // wir spaeter wissen welche Rechnungen "neutralisiert" wurden, aber
    // fuer die Positions-Zaehlung 1./2./Abschluss zaehlen nur Erstellt+
    // Versendet.
    if (pi.status_code !== 100 && pi.status_code !== 200) continue;
    const arr = projectInvoiceMap.get(pi.project_match_id) ?? [];
    arr.push(pi);
    projectInvoiceMap.set(pi.project_match_id, arr);
  }
  // Pro Projekt nach document_date aufsteigend sortieren (alteste zuerst).
  for (const arr of projectInvoiceMap.values()) {
    arr.sort((a, b) => {
      const ta = a.document_date ? Date.parse(a.document_date) : 0;
      const tb = b.document_date ? Date.parse(b.document_date) : 0;
      return ta - tb;
    });
  }

  const now = Date.now();
  const allRows: PvCashInvoiceRow[] = [];

  for (const inv of invoiceList) {
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

    // Position der Rechnung im Projekt bestimmen.
    const projectInvList = inv.project_match_id
      ? projectInvoiceMap.get(inv.project_match_id) ?? []
      : [];
    const pos1 = projectInvList.findIndex((i) => i.id === inv.id) + 1; // 1-indexed; 0 wenn nicht gefunden
    const derivedType = deriveInvoiceType(
      pos1,
      projectInvList.length,
      project.step_name,
      inv.document_type_name
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
      documentTypeName: inv.document_type_name,
      derivedType,
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
