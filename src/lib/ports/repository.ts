/**
 * The persistence port. Two adapters implement it: an in-memory one that backs
 * the zero-config demo and the tests, and a Postgres one where the bitemporal
 * invariant is enforced by an EXCLUDE gist constraint rather than by code.
 *
 * The port is deliberately narrow. It owns the two things that genuinely need a
 * stateful, concurrent, durable store — the bitemporal reading log and the
 * transactional outbox — and nothing else. Pricing, the ledger and adjustments
 * stay in the pure core (domain/), computed from whatever the port returns; a
 * store should not re-implement arithmetic that is already proven by property.
 */

import type { Range } from "../domain/time";
import type { MeterId, Reading, ReadingSource } from "../domain/types";
import type { IngestOutcome } from "../domain/billing";

/** A physical bitemporal reading row — both time axes made explicit. */
export interface ReadingRow {
  readonly id: string;
  readonly meterId: MeterId;
  readonly validStart: number;
  readonly validEnd: number;
  readonly txStart: number;
  readonly txEnd: number | null;
  readonly kwh: number;
  readonly source: ReadingSource;
  readonly idempotencyKey: string;
}

export interface OutboxRow {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly createdAt: number;
  readonly publishedAt: number | null;
}

export interface IngestReceipt {
  readonly outcome: IngestOutcome;
  readonly id: string;
}

export interface Repository {
  /**
   * Idempotently record a reading and enqueue its outbox event in one atomic
   * step. A repeated idempotency key is a no-op; a new reading over an interval
   * already asserted closes the prior assertion's transaction-time and inserts a
   * fresh one — never an update in place.
   */
  ingestReading(reading: Reading, now: number): Promise<IngestReceipt>;

  /** Readings believed as of `knownAsOf` whose valid-time touches `window`. */
  knownReadings(meterId: MeterId, window: Range, knownAsOf: number): Promise<ReadingRow[]>;

  /** Every physical version for a meter, for an audit timeline. */
  readingHistory(meterId: MeterId): Promise<ReadingRow[]>;

  /** Unpublished outbox rows, oldest first. */
  pendingOutbox(limit?: number): Promise<OutboxRow[]>;

  /** Mark rows published after the relay has handed them off. */
  markPublished(ids: readonly string[], now: number): Promise<void>;

  /** Cheap liveness probe used by /api/health. */
  healthCheck(): Promise<void>;

  /** The store's kind, surfaced so the UI can show which path is live. */
  readonly kind: "memory" | "postgres";
}
