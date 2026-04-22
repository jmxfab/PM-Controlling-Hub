/**
 * Minimal Hero GraphQL client for the sync CLI.
 *
 * Standalone (no Next.js imports) so it can run in GitHub Actions via tsx.
 * Reads HERO_API_KEY from process.env directly.
 */

const HERO_ENDPOINT = "https://login.hero-software.de/api/external/v7/graphql";

export async function heroGraphQL<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = process.env.HERO_API_KEY;
  if (!apiKey) {
    throw new Error("HERO_API_KEY environment variable is required.");
  }

  const response = await fetch(HERO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Hero API request failed: ${response.status} ${response.statusText}${
        body ? ` — ${body.slice(0, 200)}` : ""
      }`
    );
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e) => e.message).join(", ");
    throw new Error(`Hero GraphQL errors: ${messages}`);
  }

  return json.data as T;
}

export async function heroGraphQLWithRetry<T = unknown>(
  query: string,
  variables: Record<string, unknown> | undefined,
  opts: { retries?: number; backoffMs?: number } = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 1500;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await heroGraphQL<T>(query, variables);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const wait = backoffMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Hero GraphQL failed"));
}
