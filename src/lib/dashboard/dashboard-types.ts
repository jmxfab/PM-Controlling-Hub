export const DASHBOARD_DEPARTMENTS = [
  "GESAMT",
  "PV",
  "PV_GEWERBE",
  "WP",
  "KLIMA",
  "GEBAEUDETECHNIK",
] as const;

export type Department = (typeof DASHBOARD_DEPARTMENTS)[number];
export type ProjectDepartment = Exclude<Department, "GESAMT">;

export const DASHBOARD_DEPARTMENT_SHORT_LABELS: Record<Department, string> = {
  GESAMT: "Gesamt",
  PV: "PV",
  PV_GEWERBE: "PV Gewerbe",
  WP: "WP",
  KLIMA: "Klima",
  GEBAEUDETECHNIK: "Gebäudetechnik",
};

export const DASHBOARD_DEPARTMENT_NAMES: Record<Department, string> = {
  GESAMT: "Gesamtunternehmen",
  PV: "Photovoltaik",
  PV_GEWERBE: "PV Gewerbe",
  WP: "Wärmepumpen",
  KLIMA: "Klima",
  GEBAEUDETECHNIK: "Gebäudetechnik",
};

/**
 * Hero project_type.id → dashboard department.
 * Only type_ids that map to a value here are included in the dashboard;
 * everything else (notably Leads / inactive legacy types) is filtered out.
 */
export const HERO_TYPE_ID_TO_DEPARTMENT: Record<string, ProjectDepartment> = {
  "36933": "PV",              // ☀️ Photovoltaik
  "36936": "PV_GEWERBE",      // ☀️ PV Gewerbe
  "36934": "WP",              // ♨️ Wärmepumpe
  "39820": "KLIMA",           // 🥶 Klima
  "36935": "GEBAEUDETECHNIK", // 👨🏻‍🔧 Gebäudetechnik
  "29899": "GEBAEUDETECHNIK", // Gebäudetechnik (ältere, aktive Variante)
};

export function mapHeroTypeIdToDepartment(
  typeId: string | number | null | undefined
): ProjectDepartment | null {
  if (typeId == null) return null;
  return HERO_TYPE_ID_TO_DEPARTMENT[String(typeId)] ?? null;
}

export interface DashboardProjectDocument {
  id?: string;
  documentNumber?: string | null;
  document_number?: string | null;
  type?: string | null;
  baseType?: string | null;
  base_type?: string | null;
  value?: number | null;
  statusCode?: string | null;
  status_code?: string | null;
  statusText?: string | null;
  status_text?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  created?: string | null;
  fileUrl?: string | null;
  file_url?: string | null;
  fileName?: string | null;
  file_name?: string | null;
  [key: string]: unknown;
}

export interface DashboardProjectListItem {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  status: string | null;
  /** Fine-grained Hero step name — carries the emoji (e.g. "🏁 Abgeschlossen"). */
  stepName?: string | null;
  department: ProjectDepartment;
  snapshotDate: string;
  projectType?: string | null;
  measureShort?: string | null;
  measureName?: string | null;
  createdAt?: string | null;
  modifiedAt?: string | null;
  maturityDate?: string | null;
  customerName?: string | null;
  customerContactName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customer?: Record<string, unknown> | null;
  contact?: Record<string, unknown> | null;
  address?: Record<string, unknown> | null;
  customerDocuments?: DashboardProjectDocument[] | null;
  customer_documents?: DashboardProjectDocument[] | null;
  [key: string]: unknown;
}

export function parseDashboardDepartmentParam(
  value: string | string[] | undefined
): Department {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (
    normalizedValue &&
    DASHBOARD_DEPARTMENTS.includes(normalizedValue as Department)
  ) {
    return normalizedValue as Department;
  }

  return "GESAMT";
}
