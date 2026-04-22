/**
 * Hero contacts → public.hero_contacts
 *
 * Top-level `contacts` query with pagination.
 */

import type { HeroEntitySync } from "../sync-engine";

interface ContactRaw {
  id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone_home?: string | null;
  phone_business?: string | null;
  phone_mobile?: string | null;
  modified?: string | null;
}

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  raw: ContactRaw;
  hero_modified_at: string | null;
  synced_at: string;
  is_deleted: boolean;
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
        first_name
        last_name
        company_name
        email
        phone_home
        phone_business
        phone_mobile
        modified
      }
    }
  `,
  extract: (data) =>
    (data as { contacts?: ContactRaw[] } | null)?.contacts ?? [],
  normalize: (raw) => ({
    id: String(raw.id),
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    company_name: raw.company_name ?? null,
    email: raw.email ?? null,
    phone: raw.phone_mobile ?? raw.phone_business ?? raw.phone_home ?? null,
    raw,
    hero_modified_at: raw.modified ?? null,
    synced_at: new Date().toISOString(),
    is_deleted: false,
  }),
};
