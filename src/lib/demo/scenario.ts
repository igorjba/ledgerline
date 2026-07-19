/**
 * Shared demo scenario helpers, used by both the console store and the invariant
 * harness — the two client-side drivers of the pure engine. Keeping the hourly
 * reading builder and the cycle constants here removes the identical copies the
 * two used to carry.
 *
 * This is demo/harness wiring, not domain: the fixtures in the test files stay
 * independent on purpose and do not import from here.
 */

import { fromLocalParts, MS_PER_HOUR, type BillingCycle, type Reading } from "@/lib/domain";

export const DEMO_METER = "MTR-2207";
export const DEMO_CYCLE: BillingCycle = { year: 2026, month: 7 };
export const MONTH_START = fromLocalParts(2026, 7, 1);

/** A one-hour reading whose interval starts `slot` hours into the cycle. */
export function makeHourlyReading(meterId: string, slot: number, kwh: number, key: string): Reading {
  const start = MONTH_START + slot * MS_PER_HOUR;
  return {
    idempotencyKey: key,
    meterId,
    periodStart: start,
    periodEnd: start + MS_PER_HOUR,
    kwh,
    source: "ami",
  };
}
