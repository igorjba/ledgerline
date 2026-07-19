/**
 * Neon serverless client. `neon()` speaks HTTP, which suits short-lived
 * serverless invocations — no pool to warm, no socket to leak. A single tagged-
 * template statement is atomic on its own, which is exactly how the reading
 * ingestion is written (a CTE), so no explicit transaction is needed there.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * The minimum a repository needs from a database: run a parameterised statement,
 * get rows back. Both the Neon serverless driver (production, over HTTP) and
 * node-postgres (tests and migrations, over TCP) satisfy this, so the same
 * repository runs against either without knowing which.
 */
export interface SqlExecutor {
  query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
}

let cached: NeonQueryFunction<false, false> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  cached ??= neon(url);
  return cached;
}

/** For tests/tooling that connect to an arbitrary database. */
export function makeSql(url: string): NeonQueryFunction<false, false> {
  return neon(url);
}
