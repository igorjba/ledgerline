import { describe, expect, it } from "vitest";
import { fromLocalParts } from "../calendar";
import { DEFAULT_WHITE_TARIFF } from "../tariff";
import type { Reading } from "../types";
import { computeInvoice } from "./invoice";

const cycle = { year: 2026, month: 7 } as const;

function reading(key: string, start: number, kwh: number): Reading {
  return { idempotencyKey: key, meterId: "M", periodStart: start, periodEnd: start + 3_600_000, kwh, source: "ami" };
}

describe("computeInvoice bills only readings whose start falls in the cycle", () => {
  it("ignores a reading that starts outside the cycle, whatever the caller passes", () => {
    // The invoices API hands computeInvoice every reading that *overlaps* the cycle
    // window; a boundary-straddling reading must still be billed in exactly one
    // cycle, so computeInvoice itself drops the one that starts outside.
    const inJuly = reading("a", fromLocalParts(2026, 7, 15, 10), 10);
    const startsInAugust = reading("b", fromLocalParts(2026, 8, 1, 0), 999); // overlaps neither by start

    const only = computeInvoice({ meterId: "M", cycle, readings: [inJuly], tariff: DEFAULT_WHITE_TARIFF, flagColor: "green" });
    const withStray = computeInvoice({
      meterId: "M",
      cycle,
      readings: [inJuly, startsInAugust],
      tariff: DEFAULT_WHITE_TARIFF,
      flagColor: "green",
    });

    expect(withStray.kwh).toBe(10);
    expect(withStray.totalCents).toBe(only.totalCents); // the August reading did not leak in
  });
});
