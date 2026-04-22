/**
 * Hero contacts → public.hero_contacts
 */

import type { HeroEntitySync } from "../sync-engine";

interface ContactRaw {
  id: string | number;
  nr?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone_home?: string | null;
  phone_mobile?: string | null;
  category?: string | null;
  parent_customer_id?: string | number | null;
  modified?: string | null;
}

interface ContactRow {
  id: string;
  nr: string | null;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone_home: string | null;
  phone_mobile: string | null;
  category: string | null;
  parent_customer_id: string | null;
  raw: ContactRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
}

function fullNameOf(c: ContactRaw): string | null {
  const company = c.company_name?.trim();
  if (company) return company;
  const parts = [c.first_name, c.last_name]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" ");
  return parts || null;
}

export const contactsSync: HeroEntitySync<ContactRaw, ContactRow> = {
  name: "contacts",
  table: "hero_contacts",
  pageSize: 200,
  concurrency: 3,
  query: /* GraphQL */ `
    query SyncContacts($first: Int!, $offset: Int!) {
      contacts(first: $first, offset: $offset, orderBy: "id") {
        id
        nr
        first_name
        last_name
        company_name
        email
        phone_home
        phone_mobile
        category
        parent_customer_id
        modified
      }
    }
  `,
  extract: (data) =>
    (data as { contacts?: ContactRaw[] } | null)?.contacts ?? [],
  normalize: (raw) => ({
    id: String(raw.id),
    nr: raw.nr ?? null,
    full_name: fullNameOf(raw),
    company_name: raw.company_name ?? null,
    email: raw.email ?? null,
    phone_home: raw.phone_home ?? null,
    phone_mobile: raw.phone_mobile ?? null,
    category: raw.category ?? null,
    parent_customer_id:
      raw.parent_customer_id != null ? String(raw.parent_customer_id) : null,
    raw,
    hero_modified_at: raw.modified ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
