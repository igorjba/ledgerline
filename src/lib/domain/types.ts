/**
 * Shared domain vocabulary. Kept free of tariff/ledger imports so it never sits
 * in an import cycle — the richer types (Invoice, LedgerEntry) live next to the
 * logic that produces them and re-export from the barrel.
 */

import { fromLocalParts } from "./calendar";
import { range, type Instant, type Range } from "./time";

export type MeterId = string;

/** Where a reading came from — an estimate is priced the same but flagged. */
export type ReadingSource = "ami" | "manual" | "estimate";

/**
 * A metered interval of consumption: `kwh` used between `[periodStart, periodEnd)`.
 * This is the raw fact the system ingests. `idempotencyKey` is the caller's
 * dedupe handle — the same key twice is the same fact, however out of order or
 * however many times it arrives.
 */
export interface Reading {
  readonly idempotencyKey: string;
  readonly meterId: MeterId;
  readonly periodStart: Instant;
  readonly periodEnd: Instant;
  readonly kwh: number;
  readonly source: ReadingSource;
}

/** A billing cycle is a local (BRT) calendar month. */
export interface BillingCycle {
  readonly year: number;
  /** 1–12. */
  readonly month: number;
}

/** The valid-time range a cycle covers, `[first day 00:00, next month 00:00)`. */
export function cycleRange(cycle: BillingCycle): Range {
  const start = fromLocalParts(cycle.year, cycle.month, 1);
  const nextMonth = cycle.month === 12 ? 1 : cycle.month + 1;
  const nextYear = cycle.month === 12 ? cycle.year + 1 : cycle.year;
  const end = fromLocalParts(nextYear, nextMonth, 1);
  return range(start, end);
}

/** `2026-07`, the stable key a cycle is addressed by. */
export function cycleKey(cycle: BillingCycle): string {
  return `${cycle.year}-${String(cycle.month).padStart(2, "0")}`;
}
