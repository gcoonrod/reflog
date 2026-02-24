import type { CoreConfig } from "./config.js";

export type QueryParam = string | number | boolean | null;

export interface D1Meta {
  changes: number;
  duration: number;
  rows_read: number;
  rows_written: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

interface D1ResultSet {
  results: Record<string, unknown>[];
  success: boolean;
  meta: D1Meta;
  error?: string;
}

interface CloudflareErrorEnvelope {
  success: false;
  errors: { code: number; message: string }[];
  messages: unknown[];
  result: null;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: QueryParam[],
  config: CoreConfig
): Promise<D1Result<T>> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/d1/database/${config.d1DatabaseId}/query`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });
  } catch (err) {
    // Network error (fetch TypeError) — endpoint unreachable
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not connect to Cloudflare API: ${message}`);
  }

  // HTTP 4xx/5xx — Cloudflare API envelope format
  if (!response.ok) {
    const status = response.status;

    if (status === 401) {
      throw new Error(
        "Authentication failed (HTTP 401). Check your CLOUDFLARE_API_TOKEN."
      );
    }
    if (status === 403) {
      throw new Error(
        "Access denied (HTTP 403). Ensure your API token has D1 read/write permissions."
      );
    }
    if (status === 404) {
      throw new Error(
        "Database not found (HTTP 404). Check CLOUDFLARE_ACCOUNT_ID and D1_DATABASE_ID."
      );
    }
    if (status === 429) {
      throw new Error(
        "Rate limited by Cloudflare API. Try again in a few seconds."
      );
    }
    if (status >= 500) {
      throw new Error(
        `Cloudflare API error (HTTP ${status}). Try again later.`
      );
    }

    // Other 4xx — try to extract error message from envelope
    let detail = "";
    try {
      const envelope = (await response.json()) as CloudflareErrorEnvelope;
      detail = envelope.errors?.map((e) => e.message).join("; ") ?? "";
    } catch {
      // Could not parse envelope — fall through to generic message
    }
    throw new Error(
      `Cloudflare API error (HTTP ${status})${detail ? `: ${detail}` : ". Try again later."}`
    );
  }

  // HTTP 200 — parse response body
  // The D1 API may return either a raw array [{...}] or an envelope { result: [{...}] }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    const text = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Unexpected API response (HTTP ${response.status}): ${text.slice(0, 200)}`
    );
  }

  // Extract the result sets array from whichever shape we received
  let resultSets: unknown[];
  if (Array.isArray(body)) {
    resultSets = body;
  } else if (
    body !== null &&
    typeof body === "object" &&
    "result" in body &&
    Array.isArray((body as { result: unknown }).result)
  ) {
    resultSets = (body as { result: unknown[] }).result;
  } else {
    throw new Error(
      `Unexpected API response (HTTP ${response.status}): ${JSON.stringify(body).slice(0, 200)}`
    );
  }

  const resultSet = resultSets[0] as D1ResultSet;

  // SQL error — HTTP 200 but success: false
  if (!resultSet.success) {
    throw new Error(`D1 query error: ${resultSet.error ?? "Unknown error"}`);
  }

  return {
    results: resultSet.results as T[],
    success: resultSet.success,
    meta: resultSet.meta,
  };
}
