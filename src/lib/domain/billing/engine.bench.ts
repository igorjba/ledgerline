import { bench, describe } from "vitest";
import { fromLocalParts } from "../calendar";
import type { Reading } from "../types";
import { createBillingState, ingest, invoiceAsOf, issueInvoice, type BillingState } from "./engine";

/*
 * Micro-benchmarks of the pure billing core. Run with `npm run bench`. Each state
 * is immutable, so every iteration does the full work from the same base (never a
 * duplicate no-op): `ingest` on a fixed base always accepts a fresh key, and
 * `issueInvoice` always cuts the invoice anew.
 */

const CYCLE = { year: 2026, month: 7 } as const;
const MONTH_START = fromLocalParts(2026, 7, 1);
const HOUR = 3_600_000;
const NOW = fromLocalParts(2026, 8, 1);

function reading(i: number): Reading {
  const start = MONTH_START + i * HOUR;
  return {
    idempotencyKey: `k-${i}`,
    meterId: "M",
    periodStart: start,
    periodEnd: start + HOUR,
    kwh: 1 + (i % 40) / 2,
    source: "ami",
  };
}

/** A meter pre-loaded with `n` hourly readings (a load curve). */
function seed(n: number): BillingState {
  let state = createBillingState("M");
  for (let i = 0; i < n; i++) state = ingest(state, reading(i), NOW + i).state;
  return state;
}

const base24 = seed(24); // a day of hourly readings
const base720 = seed(720); // a month of hourly readings

describe("billing core", () => {
  bench("ingest a reading — 24-reading meter", () => {
    ingest(base24, reading(100_000), NOW);
  });

  bench("ingest a reading — 720-reading meter", () => {
    ingest(base720, reading(100_000), NOW);
  });

  bench("issue invoice — 24 readings", () => {
    issueInvoice(base24, CYCLE, NOW);
  });

  bench("issue invoice — 720 readings", () => {
    issueInvoice(base720, CYCLE, NOW);
  });

  bench("as-of invoice query — 720 readings", () => {
    invoiceAsOf(base720, CYCLE, NOW);
  });
});
