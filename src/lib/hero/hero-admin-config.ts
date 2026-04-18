import {
  HeroProject,
  getDepartmentFromProjectNumber,
} from "@/lib/hero/hero-client";

export const HERO_ADMIN_DEFAULT_ENDPOINT =
  "https://login.hero-software.de/api/external/v7/graphql";

export const HERO_PROJECT_URL_TEMPLATE_ENV_NAME = "HERO_PROJECT_URL_TEMPLATE";

export const HERO_PROJECT_LINK_TEMPLATE_PLACEHOLDERS = [
  "{projectId}",
  "{projectNumber}",
  "{department}",
] as const;

export interface HeroAdminDraft {
  endpoint: string;
  projectLinkTemplate: string;
}

export interface HeroAdminDraftValidation {
  normalizedDraft: HeroAdminDraft;
  issues: Partial<Record<keyof HeroAdminDraft, string>>;
  isValid: boolean;
}

export interface HeroProjectLinkSource {
  id: string;
  project_number: string | null;
}

export const HERO_ADMIN_DRAFT_DEFAULTS: HeroAdminDraft = {
  endpoint: HERO_ADMIN_DEFAULT_ENDPOINT,
  projectLinkTemplate: "",
};

export const HERO_PROJECT_LINK_PREVIEW_SAMPLE: HeroProject = {
  id: "hero-preview-project-42",
  project_number: "PV24-101",
  name: "PV Musterprojekt 42",
  status: "aktiv",
};

export function validateHeroAdminDraft(
  draft: HeroAdminDraft
): HeroAdminDraftValidation {
  const normalizedDraft = {
    endpoint: draft.endpoint.trim(),
    projectLinkTemplate: draft.projectLinkTemplate.trim(),
  };

  const issues: HeroAdminDraftValidation["issues"] = {};

  if (!normalizedDraft.endpoint) {
    issues.endpoint = "Bitte einen Hero GraphQL Endpoint angeben.";
  } else {
    try {
      new URL(normalizedDraft.endpoint);
    } catch {
      issues.endpoint =
        "Bitte eine gültige URL für den Hero GraphQL Endpoint angeben.";
    }
  }

  return {
    normalizedDraft,
    issues,
    isValid: Object.keys(issues).length === 0,
  };
}

export function formatHeroProjectLink(
  template: string,
  project: HeroProjectLinkSource
): string | null {
  const normalizedTemplate = template.trim();

  if (!normalizedTemplate) {
    return null;
  }

  return normalizedTemplate
    .replaceAll("{projectId}", project.id)
    .replaceAll("{projectNumber}", project.project_number ?? "")
    .replaceAll(
      "{department}",
      getDepartmentFromProjectNumber(project.project_number)
    );
}
