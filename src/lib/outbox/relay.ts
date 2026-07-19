/**
 * The outbox relay: read unpublished rows, publish each, mark it drained. Pure
 * with respect to transport — the `publish` function is injected, so this is unit-
 * tested against an in-memory repo and a fake publisher, and runs in production
 * against Postgres and QStash without changing a line.
 *
 * Failure handling is deliberate. Rows are marked published only after `publish`
 * resolves; if one throws, the relay stops, marks whatever already succeeded, and
 * lets the next drain retry the rest. Combined with an idempotent consumer (the
 * dedup id on each publish), at-least-once delivery is safe.
 */

import type { Repository } from "../ports/repository";
import type { Publisher } from "./qstash";

export interface DrainResult {
  readonly drained: number;
  readonly ids: readonly string[];
}

export async function relayOutbox(
  repo: Repository,
  publish: Publisher,
  now: number,
  limit = 100,
): Promise<DrainResult> {
  const pending = await repo.pendingOutbox(limit);
  const published: string[] = [];
  try {
    for (const event of pending) {
      await publish(event);
      published.push(event.id);
    }
  } finally {
    if (published.length > 0) await repo.markPublished(published, now);
  }
  return { drained: published.length, ids: published };
}
