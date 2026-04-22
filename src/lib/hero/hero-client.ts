/**
 * Hero Software GraphQL Client
 * Endpoint: https://login.hero-software.de/api/external/v7/graphql
 * Auth: Authorization: Bearer YOUR_API_KEY
 *
 * API-Key-Auflösung (DB-first, env-fallback):
 *  1. `app_settings.hero_api_key` (UI-verwaltet)
 *  2. `process.env.HERO_API_KEY` (Dev-Fallback)
 *
 * Abteilung wird über Projektnummer-Präfix ermittelt:
 *  - PV...  → Photovoltaik
 *  - WÄP... → Wärmepumpen
 *  - Rest   → Haustechnik
 */

import { getActiveHeroApiKey } from "@/lib/settings/hero-settings";

const HERO_ENDPOINT = "https://login.hero-software.de/api/external/v7/graphql";

export type HeroDepartment =
  | "PV"
  | "PV_GEWERBE"
  | "WP"
  | "KLIMA"
  | "GEBAEUDETECHNIK";

export interface HeroParty {
  id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone_home?: string | null;
}

export interface HeroAddress {
  street?: string | null;
  city?: string | null;
  zipcode?: string | null;
}

export interface HeroDocumentType {
  base_type?: string | null;
  name?: string | null;
}

export interface HeroFileUpload {
  url?: string | null;
}

export interface HeroCustomerDocument {
  id?: string | number | null;
  nr?: string | null;
  type?: string | null;
  status_code?: string | number | null;
  status_name?: string | null;
  value?: number | null;
  vat?: number | null;
  created?: string | null;
  file_upload?: HeroFileUpload | null;
  document_type?: HeroDocumentType | null;
}

export interface HeroProjectMatchStatus {
  id?: string | number | null;
  status_code?: string | number | null;
  name?: string | null;
  short_name?: string | null;
  created?: string | null;
  modified?: string | null;
  maturity_date?: string | null;
}

export interface HeroProject {
  id: string;
  project_number: string | null;
  name: string | null;
  status: string | null;
  project_type?: string | null;
  type_id?: string | null;
  department?: HeroDepartment | null;
  step_id?: string | null;
  step_name?: string | null;
  step_sort_order?: number | null;
  measure_short?: string | null;
  measure_name?: string | null;
  created_at?: string | null;
  modified_at?: string | null;
  maturity_date?: string | null;
  customer?: HeroParty | null;
  contact?: HeroParty | null;
  address?: HeroAddress | null;
  customer_documents?: HeroCustomerDocument[];
  project_match_statuses?: HeroProjectMatchStatus[];
  // Additional fields populated after schema discovery / later mapping work
  completion_date?: string | null;
  accounting_date?: string | null;
  accounting_amount?: number | null;
  rework_status?: string | null;
  rework_scheduled_date?: string | null;
  customer_commitment_status?: string | null;
  closing_appointment_date?: string | null;
  customer_name?: string | null;
  customer_contact_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  customerName?: string | null;
  customerContactName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerDocuments?: HeroCustomerDocument[] | null;
}

/**
 * Hero project_type.id → dashboard department.
 * Only these type_ids flow into the dashboard; everything else (Leads,
 * inactive legacy types) is filtered out at the read layer.
 */
const HERO_TYPE_ID_TO_DEPARTMENT: Record<string, HeroDepartment> = {
  "36933": "PV",              // ☀️ Photovoltaik
  "36936": "PV_GEWERBE",      // ☀️ PV Gewerbe
  "36934": "WP",              // ♨️ Wärmepumpe
  "39820": "KLIMA",           // 🥶 Klima
  "36935": "GEBAEUDETECHNIK", // 👨🏻‍🔧 Gebäudetechnik
  "29899": "GEBAEUDETECHNIK", // Gebäudetechnik (alte aktive Variante)
};

/**
 * Returns the dashboard department for a Hero project based on its type_id.
 * Returns null for project types we don't display (e.g. Leads).
 */
export function getDepartmentFromHeroTypeId(
  typeId: string | number | null | undefined
): HeroDepartment | null {
  if (typeId == null) return null;
  return HERO_TYPE_ID_TO_DEPARTMENT[String(typeId)] ?? null;
}

/**
 * Legacy project-number prefix fallback — only kept for tests that don't
 * have a type_id. New code should use getDepartmentFromHeroTypeId().
 */
export function getDepartmentFromProjectNumber(
  projectNumber: string | null | undefined
): HeroDepartment {
  if (!projectNumber) return "GEBAEUDETECHNIK";
  const upper = projectNumber.toUpperCase();
  if (upper.startsWith("PV")) return "PV";
  if (upper.startsWith("WÄP") || upper.startsWith("WAP")) return "WP";
  return "GEBAEUDETECHNIK";
}

/** Generic GraphQL fetch helper */
async function heroGraphQL<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = await getActiveHeroApiKey();
  if (!apiKey) {
    throw new Error(
      "Hero API Key ist nicht gesetzt. Bitte im Dashboard unter 'Hero Read-only Status' eintragen oder HERO_API_KEY als Umgebungsvariable setzen."
    );
  }

  const response = await fetch(HERO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
    // Don't cache - always fetch fresh data for sync
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Hero API request failed: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e: { message: string }) => e.message).join(", ");
    throw new Error(`Hero GraphQL errors: ${messages}`);
  }

  return json.data as T;
}

interface HeroProjectMatchRaw {
  id: string | number;
  project_id?: string | number | null;
  project_nr?: string | null;
  project_title?: string | null;
  project_type?: string | null;
  type_id?: string | number | null;
  created?: string | null;
  modified?: string | null;
  measure?: {
    short?: string | null;
    name?: string | null;
  } | null;
  customer?: HeroParty | null;
  contact?: HeroParty | null;
  address?: HeroAddress | null;
  customer_documents?: HeroCustomerDocument[] | null;
  project_match_statuses?: HeroProjectMatchStatus[] | null;
  current_project_match_status?: {
    id?: string | number | null;
    status_code?: string | number | null;
    name?: string | null;
    short_name?: string | null;
    created?: string | null;
    modified?: string | null;
    maturity_date?: string | null;
    step?: {
      id?: string | number | null;
      name?: string | null;
      sort_order?: number | null;
    } | null;
  } | null;
}

export function normalizeHeroProject(rawProject: HeroProjectMatchRaw): HeroProject {
  const projectStatuses = rawProject.project_match_statuses ?? [];
  const completionStatus = findLatestStatusByName(projectStatuses, [
    "abgeschlossen",
    "fertig",
    "done",
    "finished",
    "archiviert",
  ]);
  const accountingStatus = findLatestStatusByName(projectStatuses, [
    "kundenrechnung",
    "schlussrechnung",
    "fakturiert",
    "buchhaltung",
  ]);
  const reworkStatus = findLatestStatusByName(projectStatuses, [
    "reklamation",
    "nacharbeit",
  ]);
  const commitmentStatus = findLatestStatusByName(projectStatuses, [
    "auftragsbestätigung",
  ]);
  const closingStatus = findLatestStatusByName(projectStatuses, [
    "vor-ort termin",
    "vor ort termin",
  ]);
  const customerName =
    rawProject.customer?.company_name?.trim() ||
    [rawProject.customer?.first_name, rawProject.customer?.last_name]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .join(" ") ||
    null;

  const contactName =
    [rawProject.contact?.first_name, rawProject.contact?.last_name]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .join(" ") ||
    null;

  const customerAddress = [
    rawProject.address?.street,
    [rawProject.address?.zipcode, rawProject.address?.city]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .join(" "),
  ]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(", ");

  const typeId = rawProject.type_id != null ? String(rawProject.type_id) : null;
  const step = rawProject.current_project_match_status?.step ?? null;

  return {
    id: String(rawProject.id ?? rawProject.project_id ?? rawProject.project_nr ?? ""),
    project_number: rawProject.project_nr ?? null,
    name: rawProject.project_title ?? null,
    status:
      rawProject.current_project_match_status?.name ??
      rawProject.project_type ??
      null,
    project_type: rawProject.project_type ?? null,
    type_id: typeId,
    department: getDepartmentFromHeroTypeId(typeId),
    step_id: step?.id != null ? String(step.id) : null,
    step_name: step?.name ?? null,
    step_sort_order: step?.sort_order ?? null,
    measure_short: rawProject.measure?.short ?? null,
    measure_name: rawProject.measure?.name ?? null,
    created_at: rawProject.created ?? null,
    modified_at: rawProject.modified ?? null,
    maturity_date: rawProject.current_project_match_status?.maturity_date ?? null,
    customer: rawProject.customer ?? null,
    contact: rawProject.contact ?? null,
    address: rawProject.address ?? null,
    customer_documents: rawProject.customer_documents ?? [],
    customerDocuments: rawProject.customer_documents ?? [],
    project_match_statuses: projectStatuses,
    customer_name: customerName,
    customer_contact_name: contactName,
    customer_phone:
      rawProject.contact?.phone_home ?? rawProject.customer?.phone_home ?? null,
    customer_email:
      rawProject.contact?.email ?? rawProject.customer?.email ?? null,
    customer_address: customerAddress || null,
    customerName,
    customerContactName: contactName,
    customerPhone:
      rawProject.contact?.phone_home ?? rawProject.customer?.phone_home ?? null,
    customerEmail:
      rawProject.contact?.email ?? rawProject.customer?.email ?? null,
    customerAddress: customerAddress || null,
    completion_date: completionStatus?.created ?? null,
    accounting_date: accountingStatus?.created ?? null,
    accounting_amount: sumInvoiceDocumentValues(rawProject.customer_documents ?? []),
    rework_status: reworkStatus?.name ?? null,
    rework_scheduled_date: reworkStatus?.maturity_date ?? null,
    customer_commitment_status: commitmentStatus?.name ?? null,
    closing_appointment_date: closingStatus?.maturity_date ?? null,
  };
}

function findLatestStatusByName(
  statuses: HeroProjectMatchStatus[],
  patterns: string[]
): HeroProjectMatchStatus | null {
  const matchingStatuses = statuses.filter((status) => {
    const value = `${status.name ?? ""} ${status.short_name ?? ""}`.toLowerCase();
    return patterns.some((pattern) => value.includes(pattern));
  });

  if (matchingStatuses.length === 0) {
    return null;
  }

  return matchingStatuses.sort((leftStatus, rightStatus) => {
    const leftTime = Date.parse(leftStatus.created ?? leftStatus.modified ?? "") || 0;
    const rightTime = Date.parse(rightStatus.created ?? rightStatus.modified ?? "") || 0;
    return rightTime - leftTime;
  })[0] ?? null;
}

function sumInvoiceDocumentValues(documents: HeroCustomerDocument[]): number | null {
  const invoiceSum = documents.reduce((sum, document) => {
    const typeValue = `${document.type ?? ""} ${document.document_type?.name ?? ""} ${document.document_type?.base_type ?? ""}`.toLowerCase();

    if (!typeValue.includes("invoice") && !typeValue.includes("rechnung")) {
      return sum;
    }

    return sum + (document.value ?? 0);
  }, 0);

  return invoiceSum > 0 ? invoiceSum : null;
}

/**
 * Run a schema introspection query against Hero to discover available fields.
 * Call this once to understand what data Hero actually provides.
 */
export async function introspectHeroSchema(): Promise<unknown> {
  const query = `
    query IntrospectProjectMatch {
      __type(name: "ProjectMatch") {
        fields {
          name
          description
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;
  return heroGraphQL(query);
}
