/**
 * Hero project_types → public.hero_project_types
 *
 * Each project_type carries the status steps that define the Hero pipeline
 * (e.g. for "☀️ Photovoltaik": Auftragsbestätigung, Montageplanung,
 * Zählermontage, …). The dashboard renders these as the per-department
 * pipeline panel.
 */

import type { HeroEntitySync } from "../sync-engine";

interface ProjectStatusStepRaw {
  id?: string | number | null;
  name?: string | null;
  sort_order?: number | null;
}

interface ProjectTypeRaw {
  id: string | number;
  name?: string | null;
  name_plural?: string | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
  modified?: string | null;
  created?: string | null;
  project_status_steps?: ProjectStatusStepRaw[] | null;
}

interface ProjectTypeRow {
  id: string;
  raw: ProjectTypeRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

export const projectTypesRichSync: HeroEntitySync<ProjectTypeRaw, ProjectTypeRow> = {
  name: "project_types",
  table: "hero_project_types",
  isUnpaginated: true,
  query: /* GraphQL */ `
    query SyncProjectTypes {
      project_types {
        id
        name
        name_plural
        is_default
        is_active
        modified
        created
        project_status_steps {
          id
          name
          sort_order
        }
      }
    }
  `,
  extract: (data) => {
    if (!data || typeof data !== "object") return [];
    const value = (data as Record<string, unknown>).project_types;
    return Array.isArray(value) ? (value as ProjectTypeRaw[]) : [];
  },
  normalize: (raw) => ({
    id: String(raw.id),
    raw,
    hero_modified_at: raw.modified ?? raw.created ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
