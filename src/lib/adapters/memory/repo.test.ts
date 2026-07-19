import { describe, expect, it } from "vitest";
import { range } from "../../domain/time";
import type { Reading } from "../../domain/types";
import { MemoryRepo } from "./repo";

const reading = (key: string, kwh: number): Reading => ({
  idempotencyKey: key,
  meterId: "M1",
  periodStart: 0,
  periodEnd: 3_600_000,
  kwh,
  source: "ami",
});

describe("MemoryRepo matches the Postgres/domain ingestion semantics", () => {
  it("reports accepted, then duplicate for a repeated key", async () => {
    const repo = new MemoryRepo();
    const first = await repo.ingestReading(reading("k", 5), 1000);
    const second = await repo.ingestReading(reading("k", 5), 2000);
    expect(first.outcome).toBe("accepted");
    expect(second.outcome).toBe("duplicate");
    expect(await repo.readingHistory("M1")).toHaveLength(1);
  });

  it("reports corrected and supersedes the prior open assertion", async () => {
    const repo = new MemoryRepo();
    await repo.ingestReading(reading("k1", 100), 1000);
    const corrected = await repo.ingestReading(reading("k2", 250), 2000);
    expect(corrected.outcome).toBe("corrected");

    const history = await repo.readingHistory("M1");
    expect(history).toHaveLength(2);
    expect(history.filter((r) => r.txEnd === null)).toHaveLength(1);

    const window = range(0, 3_600_000);
    expect((await repo.knownReadings("M1", window, 1500)).map((r) => r.kwh)).toEqual([100]);
    expect((await repo.knownReadings("M1", window, 2500)).map((r) => r.kwh)).toEqual([250]);
  });

  it("returns copies that do not mutate under a later correction", async () => {
    const repo = new MemoryRepo();
    await repo.ingestReading(reading("k1", 100), 1000);
    const snapshot = await repo.knownReadings("M1", range(0, 3_600_000), 1500);
    await repo.ingestReading(reading("k2", 200), 2000); // closes the first row
    expect(snapshot[0]!.txEnd).toBeNull(); // the earlier copy is unchanged
  });
});
