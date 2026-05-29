/**
 * Hero company { partners } → public.hero_partners
 */

import type { HeroEntitySync } from "../sync-engine";

interface PartnerRaw {
  id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  user_id?: string | number | null;
  company_id?: string | number | null;
  modified?: string | null;
}

interface PartnerRow {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  user_id: string | null;
  company_id: string | null;
  raw: PartnerRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

function fullNameOf(p: PartnerRaw): string | null {
  const parts = [p.first_name, p.last_name]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" ");
  return parts || null;
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
          role
          status
          user_id
          company_id
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
    full_name: fullNameOf(raw),
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    email: raw.email ?? null,
    role: raw.role ?? null,
    status: raw.status ?? null,
    user_id: raw.user_id != null ? String(raw.user_id) : null,
    company_id: raw.company_id != null ? String(raw.company_id) : null,
    raw,
    hero_modified_at: raw.modified ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
