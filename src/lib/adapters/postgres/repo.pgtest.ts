/**
 * Integration tests against a real Postgres (CI spins one up with btree_gist;
 * locally, point DATABASE_URL at any Postgres 15+). These prove the claims the
 * unit tests cannot: that the schema itself — the EXCLUDE gist constraint —
 * rejects an overlapping bitemporal assertion, and that PostgresRepo behaves like
 * MemoryRepo for idempotency, correction and as-of queries.
 *
 * Skipped automatically when DATABASE_URL is unset, so `npm test` never needs a
 * database. Run them with `npm run pgtest`.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { range } from "../../domain/time";
import type { Reading } from "../../domain/types";
import type { SqlExecutor } from "./client";
import { PostgresRepo } from "./repo";
import { splitStatements } from "./sql-file";

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATION = join(dirname(fileURLToPath(import.meta.url)), "migrations", "0001_init.sql");

const day = 86_400_000;
const JULY_1 = Date.UTC(2026, 6, 1);
const reading = (key: string, startDay: number, kwh: number): Reading => ({
  idempotencyKey: key,
  meterId: "MTR-PG",
  periodStart: JULY_1 + startDay * day,
  periodEnd: JULY_1 + (startDay + 1) * day,
  kwh,
  source: "ami",
});

describe.skipIf(!DATABASE_URL)("Postgres enforces the bitemporal invariant", () => {
  let client: pg.Client;
  let repo: PostgresRepo;
  const exec: SqlExecutor = {
    query: (text, params) => client.query(text, params as unknown[]).then((r) => r.rows),
  };

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query("DROP TABLE IF EXISTS readings, outbox CASCADE");
    const sql = await readFile(MIGRATION, "utf8");
    for (const statement of splitStatements(sql)) await client.query(statement);
    repo = new PostgresRepo(exec);
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE readings, outbox");
  });

  it("rejects two overlapping OPEN assertions via the EXCLUDE constraint", async () => {
    await client.query(
      `INSERT INTO readings (id, meter_id, idempotency_key, valid_range, transaction_range, kwh, source)
       VALUES ('a', 'M', 'k1', tstzrange('2026-07-01','2026-07-03','[)'), tstzrange('2026-07-10', NULL, '[)'), 10, 'ami')`,
    );
    // Same meter, overlapping valid time, also open in transaction time.
    await expect(
      client.query(
        `INSERT INTO readings (id, meter_id, idempotency_key, valid_range, transaction_range, kwh, source)
         VALUES ('b', 'M', 'k2', tstzrange('2026-07-02','2026-07-04','[)'), tstzrange('2026-07-11', NULL, '[)'), 20, 'ami')`,
      ),
    ).rejects.toThrow(/readings_no_overlapping_assertion|exclusion/i);
  });

  it("treats a repeated idempotency key as a no-op", async () => {
    const first = await repo.ingestReading(reading("k-1", 0, 12), JULY_1 + 40 * day);
    const second = await repo.ingestReading(reading("k-1", 0, 12), JULY_1 + 41 * day);
    expect(first.outcome).toBe("accepted");
    expect(second.outcome).toBe("duplicate");
    expect(await repo.readingHistory("MTR-PG")).toHaveLength(1);
  });

  it("supersedes a correction without ever updating in place", async () => {
    const t1 = JULY_1 + 40 * day;
    const t2 = JULY_1 + 41 * day;
    await repo.ingestReading(reading("k-1", 0, 100), t1);
    const corrected = await repo.ingestReading(reading("k-1-fix", 0, 250), t2);
    expect(corrected.outcome).toBe("corrected");

    // Two physical rows: one closed, one open.
    const history = await repo.readingHistory("MTR-PG");
    expect(history).toHaveLength(2);
    expect(history.filter((r) => r.txEnd === null)).toHaveLength(1);

    // As-of reproduces the past: t1 still sees 100, t2 sees 250.
    const window = range(JULY_1, JULY_1 + 31 * day);
    const asOfT1 = await repo.knownReadings("MTR-PG", window, t1);
    const asOfNow = await repo.knownReadings("MTR-PG", window, t2 + day);
    expect(asOfT1.map((r) => r.kwh)).toEqual([100]);
    expect(asOfNow.map((r) => r.kwh)).toEqual([250]);
  });

  it("writes an outbox row per ingest and drains it once", async () => {
    await repo.ingestReading(reading("k-1", 0, 10), JULY_1 + 40 * day);
    const pending = await repo.pendingOutbox();
    expect(pending).toHaveLength(1);
    await repo.markPublished(pending.map((e) => e.id), JULY_1 + 42 * day);
    expect(await repo.pendingOutbox()).toHaveLength(0);
  });
});
