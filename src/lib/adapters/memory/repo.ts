/**
 * In-memory repository. Backs the zero-config demo and the unit tests, and is the
 * reference the Postgres adapter is held against: same idempotency, same
 * transaction-time supersession, same as-of query semantics — just enforced by
 * this code instead of by a database constraint.
 *
 * State is process-local and ephemeral. That is a feature for a public demo (no
 * setup, nothing to clean up) and the reason the Postgres path exists for anyone
 * who wants durability and real concurrency.
 */

import { overlaps, range } from "../../domain/time";
import type { MeterId, Reading } from "../../domain/types";
import type {
  IngestReceipt,
  OutboxRow,
  ReadingRow,
  Repository,
} from "../../ports/repository";
import type { Range } from "../../domain/time";

export class MemoryRepo implements Repository {
  readonly kind = "memory" as const;

  private readonly rows: ReadingRow[] = [];
  private readonly outbox: OutboxRow[] = [];
  private readonly byKey = new Map<string, IngestReceipt>();
  private seq = 0;

  async ingestReading(reading: Reading, now: number): Promise<IngestReceipt> {
    // A repeated key is a duplicate no-op — same outcome as the Postgres path and
    // the pure domain. The stored id is the original row's, but the outcome is
    // reported as "duplicate", never the original "accepted"/"corrected".
    const existing = this.byKey.get(reading.idempotencyKey);
    if (existing) return { outcome: "duplicate", id: existing.id };

    const valid = range(reading.periodStart, reading.periodEnd);
    const overlapping = this.rows.filter(
      (r) => r.meterId === reading.meterId && r.txEnd === null && rowOverlaps(r, valid),
    );
    for (const r of overlapping) closeRow(r, now);

    const id = `rd-${this.seq++}`;
    this.rows.push({
      id,
      meterId: reading.meterId,
      validStart: reading.periodStart,
      validEnd: reading.periodEnd,
      txStart: now,
      txEnd: null,
      kwh: reading.kwh,
      source: reading.source,
      idempotencyKey: reading.idempotencyKey,
    });

    this.outbox.push({
      id: `evt-${this.seq++}`,
      type: "reading.ingested",
      payload: { meterId: reading.meterId, idempotencyKey: reading.idempotencyKey, kwh: reading.kwh },
      createdAt: now,
      publishedAt: null,
    });

    const receipt: IngestReceipt = { outcome: overlapping.length > 0 ? "corrected" : "accepted", id };
    this.byKey.set(reading.idempotencyKey, receipt);
    return receipt;
  }

  // The read methods return fresh copies (like the Postgres adapter's toRow), so
  // a caller holding a result never sees it mutate when a later correction closes
  // a row or the relay marks an event published.

  async knownReadings(meterId: MeterId, window: Range, knownAsOf: number): Promise<ReadingRow[]> {
    return this.rows
      .filter(
        (r) =>
          r.meterId === meterId &&
          r.txStart <= knownAsOf &&
          (r.txEnd === null || knownAsOf < r.txEnd) &&
          rowOverlaps(r, window),
      )
      .sort((a, b) => a.validStart - b.validStart)
      .map((r) => ({ ...r }));
  }

  async readingHistory(meterId: MeterId): Promise<ReadingRow[]> {
    return this.rows
      .filter((r) => r.meterId === meterId)
      .sort((a, b) => a.txStart - b.txStart)
      .map((r) => ({ ...r }));
  }

  async pendingOutbox(limit = 100): Promise<OutboxRow[]> {
    return this.outbox
      .filter((e) => e.publishedAt === null)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  async markPublished(ids: readonly string[], now: number): Promise<void> {
    const set = new Set(ids);
    for (const e of this.outbox) {
      if (set.has(e.id)) (e as { publishedAt: number | null }).publishedAt = now;
    }
  }

  async healthCheck(): Promise<void> {
    // Nothing to reach; the in-memory store is always live.
  }
}

function rowOverlaps(r: ReadingRow, window: Range): boolean {
  return overlaps(range(r.validStart, r.validEnd), window);
}

function closeRow(r: ReadingRow, at: number): void {
  (r as { txEnd: number | null }).txEnd = at;
}
