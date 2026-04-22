/**
 * Hero company { partners } → public.hero_partners
 *
 * Employees / internal users. Same pattern as measures — returned inline
 * under `company`, so we run one unpaginated fetch.
 */

import type { HeroEntitySync } from "../sync-engine";

interface PartnerRaw {
  id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  modified?: string | null;
}

interface PartnerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  raw: PartnerRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

export const partnersSync: HeroEntitySync<PartnerRaw, PartnerRow> = {
  name: "partners",
  table: "hero_partners",
  isUnpaginated: true,
  query: /* GraphQL */ `
    query SyncPartners {
      company {
        partners {
          id
          first_name
          last_name
          email
          modified
        }
      }
    }
  `,
  extract: (data) => {
    if (!data || typeof data !== "object") return [];
    const payload = data as {
      company?: { partners?: PartnerRaw[] } | Array<{ partners?: PartnerRaw[] }>;
    };
    const company = Array.isArray(payload.company)
      ? payload.company[0]
      : payload.company;
    return (company?.partners as PartnerRaw[] | undefined)?.slice() ?? [];
  },
  normalize: (raw) => ({
    id: String(raw.id),
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    email: raw.email ?? null,
    raw,
    hero_modified_at: raw.modified ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
