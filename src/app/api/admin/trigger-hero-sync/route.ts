import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const WORKFLOW_FILENAME = "sync-hero.yml";

const DEFAULT_REPO = "jmxfab/Jumax-Controlling-Hub";

async function triggerGithubWorkflow(entities: string) {
  const pat = process.env.GITHUB_SYNC_PAT;
  if (!pat) {
    throw new Error(
      "GITHUB_SYNC_PAT environment variable is missing. Set a fine-grained PAT with actions:write scope in Vercel."
    );
  }

  const repo = process.env.GITHUB_SYNC_REPO ?? DEFAULT_REPO;
  const ref = process.env.GITHUB_SYNC_REF ?? "main";

  const response = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILENAME}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${pat}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref,
        inputs: { entities: entities || "all" },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `GitHub workflow dispatch failed: ${response.status} ${response.statusText}${
        text ? ` — ${text.slice(0, 500)}` : ""
      }`
    );
  }

  return {
    repo,
    ref,
    workflow: WORKFLOW_FILENAME,
    runsUrl: `https://github.com/${repo}/actions/workflows/${WORKFLOW_FILENAME}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request
      .json()
      .catch(() => ({} as { entities?: string | string[] }));
    const entitiesInput = payload.entities;
    const entities = Array.isArray(entitiesInput)
      ? entitiesInput.join(",")
      : typeof entitiesInput === "string"
        ? entitiesInput
        : "all";

    const result = await triggerGithubWorkflow(entities);
    return NextResponse.json({ triggered: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { triggered: false, error: message },
      { status: 500 }
    );
  }
}
