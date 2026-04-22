/**
 * Hero project_matches → public.hero_projects
 *
 * Slim query: only the columns the dashboard needs plus the current status.
 * Documents, history entries and the full status timeline live in their own
 * entities to avoid Hero's "Internal server error" on large aggregate queries.
 */

import type { HeroEntitySync } from "../sync-engine";

interface ProjectMatchRaw {
  id: string | number;
  project_id?: string | number | null;
  project_nr?: string | null;
  project_title?: string | null;
  project_type?: string | null;
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
  current_project_match_status?: {
    id?: string | number | null;
    name?: string | null;
    short_name?: string | null;
    maturity_date?: string | null;
  } | null;
}

interface ProjectRow {
  id: string;
  project_number: string | null;
  name: string | null;
  department: "PV" | "WP" | "HAUSTECHNIK";
  project_type: string | null;
  measure_short: string | null;
  measure_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  current_status: string | null;
  created_at: string | null;
  hero_modified_at: string | null;
  maturity_date: string | null;
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
          name
          short_name
          maturity_date
        }
      }
    }
  `,
  extract: (data) =>
    (data as { project_matches?: ProjectMatchRaw[] } | null)?.project_matches ?? [],
  normalize: (raw) => ({
    id: String(raw.id ?? raw.project_id ?? raw.project_nr ?? ""),
    project_number: raw.project_nr ?? null,
    name: raw.project_title ?? null,
    department: departmentFor(raw.project_nr),
    project_type: raw.project_type ?? null,
    measure_short: raw.measure?.short ?? null,
    measure_name: raw.measure?.name ?? null,
    customer_name: customerNameOf(raw),
    customer_email: raw.contact?.email ?? raw.customer?.email ?? null,
    customer_phone: raw.contact?.phone_home ?? raw.customer?.phone_home ?? null,
    customer_address: customerAddressOf(raw),
    current_status:
      raw.current_project_match_status?.name ??
      raw.current_project_match_status?.short_name ??
      raw.project_type ??
      null,
    created_at: raw.created ?? null,
    hero_modified_at: raw.modified ?? null,
    maturity_date: raw.current_project_match_status?.maturity_date ?? null,
    raw,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
