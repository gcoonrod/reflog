import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes: number; duration: number };
}

export interface D1Options {
  databaseId: string;
  env?: string;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  options: D1Options
): Promise<D1Result<T>> {
  const args = [
    "d1",
    "execute",
    options.databaseId,
    "--remote",
    "--json",
    "--command",
    sql,
  ];

  if (options.env) {
    args.push("--env", options.env);
  }

  const { stdout, stderr } = await execFileAsync("npx", ["wrangler", ...args], {
    cwd: process.cwd(),
    timeout: 30_000,
  });

  if (stderr && !stderr.includes("Retrieving cached values")) {
    // wrangler outputs non-error diagnostics to stderr; only throw on actual errors
    const isError =
      stderr.includes("ERROR") ||
      stderr.includes("error") ||
      stderr.includes("SQLITE_ERROR");
    if (isError) {
      throw new Error(`D1 query failed: ${stderr}`);
    }
  }

  try {
    const parsed = JSON.parse(stdout);
    // wrangler d1 execute --json returns an array of result sets
    const resultSet = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      results: resultSet.results ?? [],
      success: resultSet.success ?? true,
      meta: resultSet.meta ?? { changes: 0, duration: 0 },
    };
  } catch {
    throw new Error(`Failed to parse D1 response: ${stdout}`);
  }
}
