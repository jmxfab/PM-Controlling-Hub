/**
 * Hero company { measures } → public.hero_measures
 *
 * Single-company tenant (Jumax), so one unpaginated request returns every
 * measure.
 */

import type { HeroEntitySync } from "../sync-engine";

interface MeasureRaw {
  id: string | number;
  name?: string | null;
  short?: string | null;
  parent_measure_id?: string | number | null;
  modified?: string | null;
}

interface MeasureRow {
  id: string;
  name: string | null;
  short: string | null;
  parent_measure_id: string | null;
  raw: MeasureRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

export const measuresSync: HeroEntitySync<MeasureRaw, MeasureRow> = {
  name: "measures",
  table: "hero_measures",
  isUnpaginated: true,
  query: /* GraphQL */ `
    query SyncMeasures {
      company {
        measures {
          id
          name
          short
          parent_measure_id
          modified
        }
      }
    }
  `,
  extract: (data) => {
    if (!data || typeof data !== "object") return [];
    const payload = data as {
      company?: { measures?: MeasureRaw[] } | Array<{ measures?: MeasureRaw[] }>;
    };
    const company = Array.isArray(payload.company)
      ? payload.company[0]
      : payload.company;
    return (company?.measures as MeasureRaw[] | undefined)?.slice() ?? [];
  },
  normalize: (raw) => ({
    id: String(raw.id),
    name: raw.name ?? null,
    short: raw.short ?? null,
    parent_measure_id:
      raw.parent_measure_id != null ? String(raw.parent_measure_id) : null,
    raw,
    hero_modified_at: raw.modified ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
