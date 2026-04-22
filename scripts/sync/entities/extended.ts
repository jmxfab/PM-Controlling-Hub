/**
 * 14 extended Hero entities using a minimal "just store raw" pattern.
 *
 * These entity definitions request `id` + `modified` (or `created`) from Hero
 * and dump the whole object into the `raw` JSONB column. That keeps the sync
 * resilient to Hero schema changes: any new field Hero adds lands in `raw`
 * without a migration. Once a read path needs typed access, the relevant
 * columns can be promoted in a later migration.
 *
 * Entities shipped here:
 *   Paginated (top-level queries):
 *     tasks, tracking_times, absences, field_service_jobs, calendar_events,
 *     file_uploads, receipts
 *   Small / unpaginated (nested under company or small reference tables):
 *     project_types, document_types, tracking_times_categories,
 *     company_branches, company, webhooks
 *   Potentially huge (paginated, but use cautiously):
 *     histories
 */

import type { HeroEntitySync } from "../sync-engine";

interface BaseRaw {
  id: string | number;
  modified?: string | null;
  created?: string | null;
}

interface BaseRow {
  id: string;
  raw: BaseRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

interface PaginatedConfig {
  name: string;
  table: string;
  queryField: string;
  pageSize?: number;
  concurrency?: number;
  maxRows?: number;
  selectionSet?: string;
}

interface UnpaginatedConfig {
  name: string;
  table: string;
  query: string;
  extract: (data: unknown) => BaseRaw[];
}

function makePaginatedEntity(
  cfg: PaginatedConfig
): HeroEntitySync<BaseRaw, BaseRow> {
  const pageSize = cfg.pageSize ?? 100;
  const concurrency = cfg.concurrency ?? 2;
  const selectionSet = cfg.selectionSet ?? "id\n        modified\n        created";
  const queryNamePascal =
    cfg.queryField
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") || "Entity";

  const query = `
    query Sync${queryNamePascal}($first: Int!, $offset: Int!) {
      ${cfg.queryField}(first: $first, offset: $offset, orderBy: "id") {
        ${selectionSet}
      }
    }
  `;

  return {
    name: cfg.name,
    table: cfg.table,
    pageSize,
    concurrency,
    maxRows: cfg.maxRows,
    query,
    extract: (data) => {
      if (!data || typeof data !== "object") return [];
      const value = (data as Record<string, unknown>)[cfg.queryField];
      return Array.isArray(value) ? (value as BaseRaw[]) : [];
    },
    normalize: (raw) => ({
      id: String(raw.id),
      raw,
      hero_modified_at: raw.modified ?? raw.created ?? null,
      synced_at: new Date().toISOString(),
      is_deleted: false,
    }),
  };
}

function makeUnpaginatedEntity(
  cfg: UnpaginatedConfig
): HeroEntitySync<BaseRaw, BaseRow> {
  return {
    name: cfg.name,
    table: cfg.table,
    isUnpaginated: true,
    query: cfg.query,
    extract: cfg.extract,
    normalize: (raw) => ({
      id: String(raw.id),
      raw,
      hero_modified_at: raw.modified ?? raw.created ?? null,
      synced_at: new Date().toISOString(),
      is_deleted: false,
    }),
  };
}

function extractCompanyChild(field: string) {
  return (data: unknown): BaseRaw[] => {
    if (!data || typeof data !== "object") return [];
    const payload = data as {
      company?:
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | null;
    };
    const company = Array.isArray(payload.company)
      ? payload.company[0]
      : payload.company;
    const value = company?.[field];
    return Array.isArray(value) ? (value as BaseRaw[]) : [];
  };
}

// ---------------------------------------------------------------------------
// Paginated entities
// ---------------------------------------------------------------------------

export const tasksSync = makePaginatedEntity({
  name: "tasks",
  table: "hero_tasks",
  queryField: "tasks",
  pageSize: 200,
  concurrency: 3,
});

export const trackingTimesSync = makePaginatedEntity({
  name: "tracking_times",
  table: "hero_tracking_times",
  queryField: "tracking_times",
  pageSize: 500,
  concurrency: 3,
  maxRows: 200_000,
});

export const absencesSync = makePaginatedEntity({
  name: "absences",
  table: "hero_absences",
  queryField: "absences",
  pageSize: 200,
  concurrency: 2,
});

export const fieldServiceJobsSync = makePaginatedEntity({
  name: "field_service_jobs",
  table: "hero_field_service_jobs",
  queryField: "field_service_jobs",
  pageSize: 200,
  concurrency: 3,
});

export const calendarEventsSync = makePaginatedEntity({
  name: "calendar_events",
  table: "hero_calendar_events",
  queryField: "calendar_events",
  pageSize: 200,
  concurrency: 3,
});

export const fileUploadsSync = makePaginatedEntity({
  name: "file_uploads",
  table: "hero_file_uploads",
  queryField: "file_uploads",
  pageSize: 200,
  concurrency: 3,
  selectionSet: "id\n        modified\n        created\n        url",
});

export const receiptsSync = makePaginatedEntity({
  name: "receipts",
  table: "hero_receipts",
  queryField: "receipts",
  pageSize: 200,
  concurrency: 2,
});

export const historiesSync = makePaginatedEntity({
  name: "histories",
  table: "hero_histories",
  queryField: "histories",
  pageSize: 500,
  concurrency: 3,
  maxRows: 500_000,
});

// ---------------------------------------------------------------------------
// Reference / small entities (top-level)
// ---------------------------------------------------------------------------

// project_types moved to its own file (project-types.ts) — it needs the full
// project_status_steps list for the dashboard pipeline panel, not the minimal
// id/modified shape the factory emits.

export const documentTypesSync = makeUnpaginatedEntity({
  name: "document_types",
  table: "hero_document_types",
  query: /* GraphQL */ `
    query SyncDocumentTypes {
      document_types {
        id
        modified
        created
      }
    }
  `,
  extract: (data) => {
    if (!data || typeof data !== "object") return [];
    const value = (data as Record<string, unknown>).document_types;
    return Array.isArray(value) ? (value as BaseRaw[]) : [];
  },
});

export const trackingCategoriesSync = makeUnpaginatedEntity({
  name: "tracking_categories",
  table: "hero_tracking_categories",
  query: /* GraphQL */ `
    query SyncTrackingCategories {
      tracking_times_categories {
        id
        modified
        created
      }
    }
  `,
  extract: (data) => {
    if (!data || typeof data !== "object") return [];
    const value = (data as Record<string, unknown>).tracking_times_categories;
    return Array.isArray(value) ? (value as BaseRaw[]) : [];
  },
});

export const webhooksSync = makeUnpaginatedEntity({
  name: "webhooks",
  table: "hero_webhooks",
  query: /* GraphQL */ `
    query SyncWebhooks {
      webhooks {
        id
        modified
        created
      }
    }
  `,
  extract: (data) => {
    if (!data || typeof data !== "object") return [];
    const value = (data as Record<string, unknown>).webhooks;
    return Array.isArray(value) ? (value as BaseRaw[]) : [];
  },
});

// ---------------------------------------------------------------------------
// Company + nested company children
// ---------------------------------------------------------------------------

export const companyBranchesSync = makeUnpaginatedEntity({
  name: "company_branches",
  table: "hero_company_branches",
  query: /* GraphQL */ `
    query SyncCompanyBranches {
      company {
        company_branches {
          id
          modified
          created
        }
      }
    }
  `,
  extract: extractCompanyChild("company_branches"),
});

export const companySync: HeroEntitySync<BaseRaw, BaseRow> = {
  name: "company",
  table: "hero_company",
  isUnpaginated: true,
  query: /* GraphQL */ `
    query SyncCompany {
      company {
        id
        modified
        created
      }
    }
  `,
  extract: (data) => {
    if (!data || typeof data !== "object") return [];
    const payload = data as { company?: unknown };
    const value = Array.isArray(payload.company)
      ? (payload.company as BaseRaw[])
      : payload.company != null
        ? [payload.company as BaseRaw]
        : [];
    return value;
  },
  normalize: (raw) => ({
    id: String(raw.id),
    raw,
    hero_modified_at: raw.modified ?? raw.created ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};

// webhooksSync is defined but deliberately NOT registered — Hero returns
// "External webhook access is not enabled for this company." for Jumax.
// Enable it again once that feature is unlocked in Hero.
export const EXTENDED_ENTITIES = [
  tasksSync,
  trackingTimesSync,
  absencesSync,
  fieldServiceJobsSync,
  calendarEventsSync,
  fileUploadsSync,
  receiptsSync,
  historiesSync,
  documentTypesSync,
  trackingCategoriesSync,
  companyBranchesSync,
  companySync,
];

export const MASTER_DATA_ENTITY_NAMES = [
  "project_types",
  "document_types",
  "tracking_categories",
  "company_branches",
  "company",
  "measures",
  "partners",
];
