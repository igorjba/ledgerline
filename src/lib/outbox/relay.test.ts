import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../adapters/memory";
import type { Reading } from "../domain/types";
import type { OutboxRow } from "../ports/repository";
import { relayOutbox } from "./relay";

const reading = (key: string): Reading => ({
  idempotencyKey: key,
  meterId: "M1",
  periodStart: 0,
  periodEnd: 3_600_000,
  kwh: 5,
  source: "ami",
});

describe("the relay drains each event exactly once", () => {
  it("publishes pending events and marks them so a second drain is empty", async () => {
    const repo = new MemoryRepo();
    await repo.ingestReading(reading("a"), 1000);

    const published: OutboxRow[] = [];
    const first = await relayOutbox(repo, async (e) => void published.push(e), 2000);
    expect(first.drained).toBe(1);
    expect(published).toHaveLength(1);

    const second = await relayOutbox(repo, async () => {}, 3000);
    expect(second.drained).toBe(0);
  });

  it("marks only what published before an error, leaving the rest to retry", async () => {
    const repo = new MemoryRepo();
    await repo.ingestReading(reading("a"), 1000);
    await repo.ingestReading(reading("b"), 1001);

    let count = 0;
    const publish = async () => {
      count += 1;
      if (count === 2) throw new Error("queue unavailable");
    };

    await expect(relayOutbox(repo, publish, 2000)).rejects.toThrow(/unavailable/);
    // The first succeeded and is marked; the failed one is still pending.
    const stillPending = await repo.pendingOutbox();
    expect(stillPending).toHaveLength(1);
  });
});
