/**
 * Hero project_matches → public.hero_projects
 *
 * Slim GraphQL query: the columns the dashboard needs plus project_match_statuses
 * (used at sync time to derive completion_date / closing_appointment_date /
 * rework_scheduled_date). Documents stay in a separate entity so the query
 * doesn't trip Hero's "Internal server error" on aggregates.
 *
 * Derived money column (accounting_amount) is left NULL at sync time and
 * reconstructed by the read path from hero_customer_documents — same for
 * accounting_date, since both depend on joined data.
 */

import type { HeroEntitySync } from "../sync-engine";

interface ProjectMatchStatusRaw {
  id?: string | number | null;
  status_code?: string | number | null;
  name?: string | null;
  short_name?: string | null;
  created?: string | null;
  modified?: string | null;
  maturity_date?: string | null;
}

interface ProjectMatchRaw {
  id: string | number;
  project_id?: string | number | null;
  project_nr?: string | null;
  project_title?: string | null;
  project_type?: string | null;
  type_id?: string | number | null;
  created?: string | null;
  modified?: string | null;
  measure?: { short?: string | null; name?: string | null } | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
    phone_home?: string | null;
  } | null;
  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone_home?: string | null;
  } | null;
  address?: {
    street?: string | null;
    city?: string | null;
    zipcode?: string | null;
  } | null;
  current_project_match_status?:
    | (ProjectMatchStatusRaw & {
        step?: {
          id?: string | number | null;
          name?: string | null;
          sort_order?: number | null;
        } | null;
      })
    | null;
  project_match_statuses?: ProjectMatchStatusRaw[] | null;
}

interface ProjectRow {
  id: string;
  project_number: string | null;
  project_name: string | null;
  department: "PV" | "WP" | "HAUSTECHNIK";
  project_type: string | null;
  measure_short: string | null;
  measure_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  status_name: string | null;
  status_code: number | null;
  created_at_hero: string | null;
  hero_modified_at: string | null;
  maturity_date: string | null;
  completion_date: string | null;
  closing_appointment_date: string | null;
  rework_scheduled_date: string | null;
  raw: ProjectMatchRaw;
  synced_at: string;
  is_deleted: boolean;
}

function departmentFor(projectNumber: string | null | undefined): ProjectRow["department"] {
  if (!projectNumber) return "HAUSTECHNIK";
  const upper = projectNumber.toUpperCase();
  if (upper.startsWith("PV")) return "PV";
  if (upper.startsWith("WÄP") || upper.startsWith("WAP")) return "WP";
  return "HAUSTECHNIK";
}

function customerNameOf(p: ProjectMatchRaw): string | null {
  const company = p.customer?.company_name?.trim();
  if (company) return company;
  const parts = [p.customer?.first_name, p.customer?.last_name]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" ");
  return parts || null;
}

function customerAddressOf(p: ProjectMatchRaw): string | null {
  const zipCity = [p.address?.zipcode, p.address?.city]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" ");
  const joined = [p.address?.street, zipCity]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(", ");
  return joined || null;
}

function findLatestStatusByName(
  statuses: ProjectMatchStatusRaw[],
  patterns: string[]
): ProjectMatchStatusRaw | null {
  const matches = statuses.filter((status) => {
    const value = `${status.name ?? ""} ${status.short_name ?? ""}`.toLowerCase();
    return patterns.some((pattern) => value.includes(pattern));
  });
  if (matches.length === 0) return null;
  return (
    matches.sort((a, b) => {
      const leftTime = Date.parse(a.created ?? a.modified ?? "") || 0;
      const rightTime = Date.parse(b.created ?? b.modified ?? "") || 0;
      return rightTime - leftTime;
    })[0] ?? null
  );
}

function toStatusCodeInt(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const projectsSync: HeroEntitySync<ProjectMatchRaw, ProjectRow> = {
  name: "projects",
  table: "hero_projects",
  pageSize: 100,
  concurrency: 3,
  query: /* GraphQL */ `
    query SyncProjects($first: Int!, $offset: Int!) {
      project_matches(first: $first, offset: $offset, orderBy: "id") {
        id
        project_id
        project_nr
        project_title
        project_type
        type_id
        created
        modified
        measure {
          short
          name
        }
        customer {
          first_name
          last_name
          company_name
          email
          phone_home
        }
        contact {
          first_name
          last_name
          email
          phone_home
        }
        address {
          street
          city
          zipcode
        }
        current_project_match_status {
          id
          status_code
          name
          short_name
          maturity_date
          step {
            id
            name
            sort_order
            status_code
          }
        }
        project_match_statuses {
          id
          status_code
          name
          short_name
          created
          modified
          maturity_date
          step {
            id
            name
            sort_order
            status_code
          }
        }
      }
    }
  `,
  extract: (data) =>
    (data as { project_matches?: ProjectMatchRaw[] } | null)?.project_matches ?? [],
  normalize: (raw) => {
    const statuses = raw.project_match_statuses ?? [];
    const completion = findLatestStatusByName(statuses, [
      "abgeschlossen",
      "fertig",
      "done",
      "finished",
      "archiviert",
    ]);
    const rework = findLatestStatusByName(statuses, ["reklamation", "nacharbeit"]);
    const closing = findLatestStatusByName(statuses, [
      "vor-ort termin",
      "vor ort termin",
    ]);

    return {
      id: String(raw.id ?? raw.project_id ?? raw.project_nr ?? ""),
      project_number: raw.project_nr ?? null,
      project_name: raw.project_title ?? null,
      department: departmentFor(raw.project_nr),
      project_type: raw.project_type ?? null,
      measure_short: raw.measure?.short ?? null,
      measure_name: raw.measure?.name ?? null,
      customer_name: customerNameOf(raw),
      customer_email: raw.contact?.email ?? raw.customer?.email ?? null,
      customer_phone: raw.contact?.phone_home ?? raw.customer?.phone_home ?? null,
      customer_address: customerAddressOf(raw),
      status_name:
        raw.current_project_match_status?.name ??
        raw.current_project_match_status?.short_name ??
        raw.project_type ??
        null,
      status_code: toStatusCodeInt(raw.current_project_match_status?.status_code),
      created_at_hero: raw.created ?? null,
      hero_modified_at: raw.modified ?? null,
      maturity_date: raw.current_project_match_status?.maturity_date ?? null,
      completion_date: completion?.created ?? null,
      closing_appointment_date: closing?.maturity_date ?? null,
      rework_scheduled_date: rework?.maturity_date ?? null,
      raw,
      synced_at: new Date().toISOString(),
      is_deleted: false,
    };
  },
};
