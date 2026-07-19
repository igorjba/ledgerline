import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  assert,
  emptyLog,
  knownAt,
  openOverlapCount,
  projectAsOf,
  type BitemporalLog,
} from "./bitemporal";
import { range } from "./time";

const day = 86_400_000;
const validJuly = range(0, 31 * day);

describe("assert never mutates a prior row", () => {
  it("closes the overlapping open assertion and appends a new open one", () => {
    let log: BitemporalLog<number> = emptyLog();
    log = assert(log, validJuly, 100, { now: 1000, id: "a" });
    log = assert(log, validJuly, 200, { now: 2000, id: "b" });

    expect(log).toHaveLength(2);
    // The first row still exists, now closed at t=2000.
    expect(log[0]!.value).toBe(100);
    expect(log[0]!.transactionRange.end).toBe(2000);
    // The second is open.
    expect(log[1]!.value).toBe(200);
    expect(log[1]!.transactionRange.end).toBeNull();
  });
});

describe("projectAsOf answers the two-axis question", () => {
  it("returns the belief held at a past transaction time", () => {
    let log: BitemporalLog<number> = emptyLog();
    log = assert(log, validJuly, 100, { now: 1000, id: "a" });
    log = assert(log, validJuly, 200, { now: 2000, id: "b" });

    const midJuly = 15 * day;
    expect(projectAsOf(log, midJuly, 1500).map((v) => v.value)).toEqual([100]);
    expect(projectAsOf(log, midJuly, 2500).map((v) => v.value)).toEqual([200]);
  });
});

describe("at most one assertion is ever open over a valid point", () => {
  it("holds after any sequence of asserts on overlapping and disjoint ranges", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lo: fc.nat({ max: 30 }),
            span: fc.integer({ min: 1, max: 10 }),
            value: fc.integer({ min: 0, max: 999 }),
          }),
          { minLength: 1, maxLength: 25 },
        ),
        (writes) => {
          let log: BitemporalLog<number> = emptyLog();
          let now = 1000;
          for (const w of writes) {
            log = assert(log, range(w.lo * day, (w.lo + w.span) * day), w.value, { now, id: `v${now}` });
            now += 1000;
          }
          // Probe every day boundary: never two open assertions over one point.
          for (let d = 0; d <= 40; d++) {
            expect(openOverlapCount(log, range(d * day, (d + 1) * day))).toBeLessThanOrEqual(1);
          }
          // Every open row is still believed "now".
          const openCount = log.filter((v) => v.transactionRange.end === null).length;
          expect(knownAt(log, now).length).toBe(openCount);
        },
      ),
    );
  });
});
