/**
 * Postgres repository. Same contract as MemoryRepo; the difference is where the
 * bitemporal invariant lives — in the EXCLUDE gist constraint (see the migration)
 * rather than in TypeScript.
 *
 * Ingestion is one atomic statement: a CTE that (1) checks the idempotency key,
 * (2) closes any open assertion overlapping the new interval in valid time, (3)
 * inserts the new open assertion, and (4) writes the outbox row — all or nothing,
 * in a single round trip. Closing-before-inserting is what keeps the two open
 * transaction ranges from overlapping; the constraint is the backstop if a future
 * change ever forgets to.
 */

import type { MeterId, Reading } from "../../domain/types";
import type { Range } from "../../domain/time";
import type {
  IngestReceipt,
  OutboxRow,
  ReadingRow,
  Repository,
} from "../../ports/repository";
import { getSql, type SqlExecutor } from "./client";

const INGEST_SQL = `
SELECT outcome, reading_id AS "readingId"
  FROM ingest_reading(
    $1, $2, $3,
    to_timestamp($4 / 1000.0),
    to_timestamp($5 / 1000.0),
    to_timestamp($6 / 1000.0),
    $7, $8, $9
  )
`;

const SELECT_COLS = `
  id,
  meter_id                                          AS "meterId",
  (extract(epoch from lower(valid_range)) * 1000)::bigint AS "validStart",
  (extract(epoch from upper(valid_range)) * 1000)::bigint AS "validEnd",
  (extract(epoch from lower(transaction_range)) * 1000)::bigint AS "txStart",
  CASE WHEN upper_inf(transaction_range) THEN NULL
       ELSE (extract(epoch from upper(transaction_range)) * 1000)::bigint END AS "txEnd",
  kwh::float8                                        AS kwh,
  source,
  idempotency_key                                   AS "idempotencyKey"
`;

function toRow(r: Record<string, unknown>): ReadingRow {
  return {
    id: r.id as string,
    meterId: r.meterId as string,
    validStart: Number(r.validStart),
    validEnd: Number(r.validEnd),
    txStart: Number(r.txStart),
    txEnd: r.txEnd === null ? null : Number(r.txEnd),
    kwh: Number(r.kwh),
    source: r.source as ReadingRow["source"],
    idempotencyKey: r.idempotencyKey as string,
  };
}

export class PostgresRepo implements Repository {
  readonly kind = "postgres" as const;

  constructor(private readonly sql: SqlExecutor = getSql()) {}

  async ingestReading(reading: Reading, now: number): Promise<IngestReceipt> {
    const id = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const rows = (await this.sql.query(INGEST_SQL, [
      id,
      reading.meterId,
      reading.idempotencyKey,
      reading.periodStart,
      reading.periodEnd,
      now,
      reading.kwh,
      reading.source,
      eventId,
    ])) as Array<{ outcome: string; readingId: string }>;

    const row = rows[0]!;
    return { outcome: row.outcome as IngestReceipt["outcome"], id: row.readingId };
  }

  async knownReadings(meterId: MeterId, window: Range, knownAsOf: number): Promise<ReadingRow[]> {
    const rows = (await this.sql.query(
      `SELECT ${SELECT_COLS} FROM readings
        WHERE meter_id = $1
          AND transaction_range @> to_timestamp($2 / 1000.0)
          AND valid_range && tstzrange(to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0), '[)')
        ORDER BY lower(valid_range)`,
      [meterId, knownAsOf, window.start, window.end ?? 8_640_000_000_000_000],
    )) as Array<Record<string, unknown>>;
    return rows.map(toRow);
  }

  async readingHistory(meterId: MeterId): Promise<ReadingRow[]> {
    const rows = (await this.sql.query(
      `SELECT ${SELECT_COLS} FROM readings WHERE meter_id = $1 ORDER BY lower(transaction_range)`,
      [meterId],
    )) as Array<Record<string, unknown>>;
    return rows.map(toRow);
  }

  async pendingOutbox(limit = 100): Promise<OutboxRow[]> {
    const rows = (await this.sql.query(
      `SELECT id, type, payload,
              (extract(epoch from created_at) * 1000)::bigint AS "createdAt",
              CASE WHEN published_at IS NULL THEN NULL
                   ELSE (extract(epoch from published_at) * 1000)::bigint END AS "publishedAt"
         FROM outbox
        WHERE published_at IS NULL
        ORDER BY created_at
        LIMIT $1`,
      [limit],
    )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      payload: r.payload,
      createdAt: Number(r.createdAt),
      publishedAt: r.publishedAt === null ? null : Number(r.publishedAt),
    }));
  }

  async markPublished(ids: readonly string[], now: number): Promise<void> {
    if (ids.length === 0) return;
    await this.sql.query(
      `UPDATE outbox SET published_at = to_timestamp($1 / 1000.0) WHERE id = ANY($2::text[])`,
      [now, ids as string[]],
    );
  }

  async healthCheck(): Promise<void> {
    await this.sql.query("SELECT 1");
  }
}
