import { describe, expect, it } from "vitest";

import type { HeroProjectLinkSource } from "./hero-admin-config";
import {
  HERO_ADMIN_DRAFT_DEFAULTS,
  HERO_PROJECT_URL_TEMPLATE_ENV_NAME,
  formatHeroProjectLink,
  validateHeroAdminDraft,
} from "./hero-admin-config";

// Sample-Projekt nur für die URL-Template-Vorschau in diesen Tests.
// Früher als Public Export in hero-admin-config — jetzt lokal im Test,
// da es in keiner Runtime-Komponente mehr verwendet wird.
const HERO_PROJECT_LINK_PREVIEW_SAMPLE: HeroProjectLinkSource = {
  id: "hero-preview-project-42",
  project_number: "PV24-101",
};

describe("hero admin config", () => {
  it("validates the default endpoint draft", () => {
    const validation = validateHeroAdminDraft(HERO_ADMIN_DRAFT_DEFAULTS);

    expect(validation.isValid).toBe(true);
    expect(validation.normalizedDraft).toEqual(HERO_ADMIN_DRAFT_DEFAULTS);
    expect(validation.issues).toEqual({});
  });

  it("flags invalid endpoint values", () => {
    const validation = validateHeroAdminDraft({
      endpoint: "not-a-url",
      projectLinkTemplate: "https://hero.example/projects/{projectId}",
    });

    expect(validation.isValid).toBe(false);
    expect(validation.issues.endpoint).toContain("gültige URL");
  });

  it("formats Hero project links from a user-entered template", () => {
    expect(
      formatHeroProjectLink(
        "https://hero.example/{department}/{projectNumber}?id={projectId}",
        HERO_PROJECT_LINK_PREVIEW_SAMPLE
      )
    ).toBe(
      "https://hero.example/PV/PV24-101?id=hero-preview-project-42"
    );
  });

  it("returns null when no project link template is configured", () => {
    expect(formatHeroProjectLink("   ", HERO_PROJECT_LINK_PREVIEW_SAMPLE)).toBeNull();
  });

  it("documents the server-side env name for project links", () => {
    expect(HERO_PROJECT_URL_TEMPLATE_ENV_NAME).toBe(
      "HERO_PROJECT_URL_TEMPLATE"
    );
  });
});
