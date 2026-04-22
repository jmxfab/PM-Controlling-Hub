/**
 * Hero company { measures } → public.hero_measures
 *
 * Hero exposes measures only under the company entity. Single-company tenant
 * (Jumax), so one request returns the complete measures array. The engine's
 * pagination still works — offset=0 yields the full array, offset>0 yields
 * nothing, so the loop stops after the first page.
 */

import type { HeroEntitySync } from "../sync-engine";

interface MeasureRaw {
  id: string | number;
  name?: string | null;
  short?: string | null;
  modified?: string | null;
}

interface MeasureRow {
  id: string;
  name: string | null;
  short: string | null;
  raw: MeasureRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

export const measuresSync: HeroEntitySync<MeasureRaw, MeasureRow> = {
  name: "measures",
  table: "hero_measures",
  pageSize: 500,
  concurrency: 1,
  isUnpaginated: true,
  query: /* GraphQL */ `
    query SyncMeasures {
      company {
        measures {
          id
          name
          short
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
    const measures = company?.measures ?? [];
    return (measures as MeasureRaw[]).slice();
  },
  normalize: (raw) => ({
    id: String(raw.id),
    name: raw.name ?? null,
    short: raw.short ?? null,
    raw,
    hero_modified_at: raw.modified ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
