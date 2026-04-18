import "server-only";

export interface HeroSyncResult {
  totalProjects: number;
  projectsByDepartment: Record<string, number>;
  durationMs: number;
  syncedAt: string;
}

export async function runHeroSync(): Promise<HeroSyncResult> {
  throw new Error(
    "Hero-Sync ist im Read-only-Modus deaktiviert und darf keine Daten schreiben."
  );
}
