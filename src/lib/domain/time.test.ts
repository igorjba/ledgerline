import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  closeAt,
  contains,
  durationMs,
  formatRange,
  instantFromIso,
  isOpen,
  overlaps,
  range,
  toIso,
} from "./time";

describe("range helpers", () => {
  it("reports openness, duration and closes an open range", () => {
    const open = range(0, null);
    expect(isOpen(open)).toBe(true);
    expect(durationMs(open)).toBe(Infinity);
    expect(closeAt(open, 10)).toEqual({ start: 0, end: 10 });
    expect(durationMs(range(0, 10))).toBe(10);
  });

  it("round-trips ISO instants and renders a range like Postgres", () => {
    const t = instantFromIso("2026-07-01T00:00:00.000Z");
    expect(toIso(t)).toBe("2026-07-01T00:00:00.000Z");
    expect(() => instantFromIso("not-a-date")).toThrow();
    expect(formatRange(range(t, null))).toBe("[2026-07-01T00:00:00.000Z, )");
  });
});

describe("range construction", () => {
  it("rejects empty and inverted ranges, as Postgres would", () => {
    expect(() => range(10, 10)).toThrow(/empty|inverted/);
    expect(() => range(10, 5)).toThrow(/empty|inverted/);
    expect(range(0, null).end).toBeNull();
  });

  it("rejects non-finite bounds (Infinity/NaN never reach the store)", () => {
    expect(() => range(0, Infinity)).toThrow(/non-finite/);
    expect(() => range(NaN, 10)).toThrow(/non-finite/);
    expect(() => range(0, NaN)).toThrow(/non-finite/);
  });
});

describe("half-open semantics match tstzrange", () => {
  it("includes the lower bound and excludes the upper", () => {
    const r = range(0, 10);
    expect(contains(r, 0)).toBe(true);
    expect(contains(r, 9)).toBe(true);
    expect(contains(r, 10)).toBe(false);
  });

  it("treats a null upper bound as +infinity", () => {
    const r = range(0, null);
    expect(contains(r, 1e15)).toBe(true);
  });
});

describe("overlaps is symmetric and matches the && operator", () => {
  it("agrees with a brute-force point check", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        fc.nat({ max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (aLo, aSpan, bLo, bSpan) => {
          const a = range(aLo, aLo + aSpan);
          const b = range(bLo, bLo + bSpan);
          expect(overlaps(a, b)).toBe(overlaps(b, a)); // symmetric
          // Brute force: they overlap iff some integer point is in both.
          let shared = false;
          for (let t = Math.min(aLo, bLo); t < Math.max(aLo + aSpan, bLo + bSpan); t++) {
            if (contains(a, t) && contains(b, t)) {
              shared = true;
              break;
            }
          }
          expect(overlaps(a, b)).toBe(shared);
        },
      ),
    );
  });
});
