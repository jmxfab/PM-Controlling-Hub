/**
 * Registry of all Hero → Supabase entity syncs.
 *
 * The CLI (`run-all.ts`) reads this registry and runs each entity sequentially
 * (or a subset via --entities). Adding a new entity means:
 *   1. Add a `entities/<name>.ts` file exporting a `HeroEntitySync`.
 *   2. Register it in the array below.
 *   3. Ship the matching Supabase migration for the target table.
 */

import type { HeroEntitySync } from "../sync-engine";

import { contactsSync } from "./contacts";
import { customerDocumentsSync } from "./customer-documents";
import { EXTENDED_ENTITIES } from "./extended";
import { measuresSync } from "./measures";
import { partnersSync } from "./partners";
import { projectsSync } from "./projects";
import { projectTypesRichSync } from "./project-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_ENTITIES: HeroEntitySync<any, any>[] = [
  projectsSync,
  contactsSync,
  customerDocumentsSync,
  measuresSync,
  partnersSync,
  projectTypesRichSync,
  ...EXTENDED_ENTITIES,
];

export function findEntity(
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): HeroEntitySync<any, any> | undefined {
  return ALL_ENTITIES.find((entity) => entity.name === name);
}
