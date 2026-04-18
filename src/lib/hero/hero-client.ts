/**
 * Hero Software GraphQL Client
 * Endpoint: https://login.hero-software.de/api/external/v7/graphql
 * Auth: Authorization: Bearer YOUR_API_KEY
 *
 * Abteilung wird über Projektnummer-Präfix ermittelt:
 *  - PV...  → Photovoltaik
 *  - WÄP... → Wärmepumpen
 *  - Rest   → Haustechnik
 */

const HERO_ENDPOINT = "https://login.hero-software.de/api/external/v7/graphql";

export type HeroDepartment = "PV" | "WP" | "HAUSTECHNIK";

export interface HeroProject {
  id: string;
  project_number: string | null;
  name: string | null;
  status: string | null;
  // Additional fields populated after schema discovery
  completion_date?: string | null;
  accounting_date?: string | null;
  accounting_amount?: number | null;
  rework_status?: string | null;
  rework_scheduled_date?: string | null;
  customer_commitment_status?: string | null;
  closing_appointment_date?: string | null;
}

/** Determines the department from a project number prefix */
export function getDepartmentFromProjectNumber(
  projectNumber: string | null | undefined
): HeroDepartment {
  if (!projectNumber) return "HAUSTECHNIK";
  const upper = projectNumber.toUpperCase();
  if (upper.startsWith("PV")) return "PV";
  if (upper.startsWith("WÄP") || upper.startsWith("WAP")) return "WP";
  return "HAUSTECHNIK";
}

/** Generic GraphQL fetch helper */
async function heroGraphQL<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = process.env.HERO_API_KEY;
  if (!apiKey) {
    throw new Error("HERO_API_KEY is not set in environment variables.");
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

/** Fetch all projects with relevant fields from Hero */
export async function fetchAllHeroProjects(): Promise<HeroProject[]> {
  // We query all projects and determine department via prefix filter in JS.
  // Hero doesn't provide a direct aggregation endpoint, so we count manually.
  const query = `
    query GetAllProjects {
      project_matches {
        id
        project_number
        name
        status
        completion_date
        accounting_date
        accounting_amount
        rework_status
        rework_scheduled_date
        customer_commitment_status
        closing_appointment_date
      }
    }
  `;

  const data = await heroGraphQL<{ project_matches: HeroProject[] }>(query);
  return data.project_matches ?? [];
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
