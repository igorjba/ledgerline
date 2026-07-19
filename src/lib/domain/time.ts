/**
 * Time primitives that mirror Postgres `tstzrange` semantics exactly, so the
 * in-memory core and the SQL adapter agree byte-for-byte on what "overlaps",
 * "contains" and "unbounded" mean. Every range is half-open `[start, end)` with
 * an exclusive upper bound; `end === null` is `+infinity` — an assertion still
 * believed to be true, or a fact still in force.
 *
 * Instants are epoch milliseconds (UTC). No wall-clock is read in here: callers
 * pass `now` in, which is what lets the whole billing core stay a pure function
 * of its inputs and be replayed deterministically.
 */

/** Epoch milliseconds, UTC. */
export type Instant = number;

/** A half-open time range `[start, end)`. `end === null` means unbounded (∞). */
export interface Range {
  readonly start: Instant;
  readonly end: Instant | null;
}

/** Postgres `tstzrange` lower bound for `[-infinity, …)`; safe as a JS Date too. */
export const BEGINNING_OF_TIME: Instant = -8_640_000_000_000_000;

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** Treat an open upper bound as `+infinity` for comparison. */
function upper(r: Range): number {
  return r.end ?? Number.POSITIVE_INFINITY;
}

/** Construct a range, rejecting the empty/inverted/non-finite ones Postgres would reject. */
export function range(start: Instant, end: Instant | null): Range {
  if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) {
    throw new RangeError(`non-finite range bound: [${start}, ${end})`);
  }
  if (end !== null && end <= start) {
    throw new RangeError(`empty or inverted range: [${start}, ${end})`);
  }
  return { start, end };
}

/** A range still open at the top — a live assertion or an in-force fact. */
export function isOpen(r: Range): boolean {
  return r.end === null;
}

/** `t ∈ [start, end)`. */
export function contains(r: Range, t: Instant): boolean {
  return t >= r.start && t < upper(r);
}

/** The `&&` operator: do two half-open ranges share any instant? */
export function overlaps(a: Range, b: Range): boolean {
  return a.start < upper(b) && b.start < upper(a);
}

/** Close an open range at `at`, e.g. to stamp a transaction-time upper bound. */
export function closeAt(r: Range, at: Instant): Range {
  return range(r.start, at);
}

/** Duration in milliseconds; `Infinity` for an unbounded range. */
export function durationMs(r: Range): number {
  return upper(r) - r.start;
}

const ISO = (t: Instant): string => new Date(t).toISOString();

/** Human/debug rendering that matches how Postgres prints a `tstzrange`. */
export function formatRange(r: Range): string {
  return `[${ISO(r.start)}, ${r.end === null ? "" : ISO(r.end)})`;
}

/** Parse an ISO-8601 string to an Instant. Throws on an unparseable value. */
export function instantFromIso(iso: string): Instant {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new TypeError(`not an ISO-8601 instant: ${iso}`);
  return t;
}

export const toIso = ISO;
