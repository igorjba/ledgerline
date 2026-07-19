/**
 * Idempotent reading ingestion over a bitemporal log.
 *
 * Three behaviours the outside world will throw at any metering pipeline, all
 * handled here as pure state transitions:
 *
 *   duplicate  — the same `idempotencyKey` arrives again. No-op; the earlier
 *                outcome is returned unchanged. This is what makes an at-least-
 *                once delivery (an outbox, a retrying webhook) safe.
 *   out-of-order — a reading for an earlier interval arrives after a later one.
 *                Fine: readings are keyed by their valid-time interval, not by
 *                arrival, so order never changes the projected result.
 *   correction — a new reading for an interval already on file. The old
 *                assertion is closed in transaction-time and the new one appended
 *                (see bitemporal.assert); the original is never overwritten.
 */

import { assert, knownAt, openOverlapCount, type BitemporalLog } from "../bitemporal";
import { contains, range, type Instant, type Range } from "../time";
import { cycleRange, type BillingCycle, type Reading } from "../types";

export type IngestOutcome = "accepted" | "corrected" | "duplicate";

const OUTCOME_LABELS: Record<IngestOutcome, string> = {
  accepted: "aceita",
  corrected: "correção",
  duplicate: "duplicada",
};

/** Display label (Portuguese) for an ingestion outcome. */
export function outcomeLabel(outcome: IngestOutcome): string {
  return OUTCOME_LABELS[outcome];
}

export interface ReadingsState {
  readonly log: BitemporalLog<Reading>;
  /** idempotencyKey → the outcome it produced, so a replay is a true no-op. */
  readonly seen: Readonly<Record<string, IngestOutcome>>;
}

export interface IngestResult {
  readonly state: ReadingsState;
  readonly outcome: IngestOutcome;
}

export function emptyReadings(): ReadingsState {
  return { log: [], seen: {} };
}

/** The valid-time interval a reading asserts. */
export function readingValidRange(r: Reading): Range {
  return range(r.periodStart, r.periodEnd);
}

/**
 * Fold one reading into the state. `ctx.now` is transaction time and `ctx.id`
 * the new version's identity — both supplied by the caller, keeping this pure.
 */
export function ingestReading(
  state: ReadingsState,
  reading: Reading,
  ctx: { now: Instant; id: string },
): IngestResult {
  const prior = state.seen[reading.idempotencyKey];
  if (prior !== undefined) {
    return { state, outcome: "duplicate" };
  }

  const validRange = readingValidRange(reading);
  const replaces = openOverlapCount(state.log, validRange) > 0;
  const outcome: IngestOutcome = replaces ? "corrected" : "accepted";

  return {
    state: {
      log: assert(state.log, validRange, reading, ctx),
      seen: { ...state.seen, [reading.idempotencyKey]: outcome },
    },
    outcome,
  };
}

/**
 * Readings the system believed as of `knownAsOf` that belong to a billing cycle.
 * A reading belongs to the cycle that contains its `periodStart`, so each reading
 * is billed in exactly one cycle — an interval straddling a month boundary is not
 * double-counted (which a plain valid-time overlap would do).
 */
export function readingsForCycle(
  log: BitemporalLog<Reading>,
  cycle: BillingCycle,
  knownAsOf: Instant,
): Reading[] {
  const window = cycleRange(cycle);
  return knownAt(log, knownAsOf)
    .filter((v) => contains(window, v.value.periodStart))
    .map((v) => v.value);
}
