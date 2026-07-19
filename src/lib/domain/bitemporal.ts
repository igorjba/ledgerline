/**
 * Bitemporal versioning: the same fact carries two independent time axes.
 *
 *   valid_time        — when the fact is true in the world (the consumption
 *                       interval, the month a tariff applies to).
 *   transaction_time  — when the system believed it (a half-open assertion that
 *                       stays open, `[insertedAt, ∞)`, until something supersedes
 *                       it).
 *
 * The one rule that makes an audit trail trustworthy: a correction never mutates
 * a prior row. `assert` closes the transaction_time of whatever it overrides
 * (stamping the upper bound) and appends a new open version. Nothing is ever
 * updated in place, so any past belief is still reconstructable — `projectAsOf`
 * answers "what did we think the world looked like, as known on date X, valid on
 * date Y" by reading the two bounds back.
 *
 * The Postgres adapter enforces the same shape with an EXCLUDE gist constraint:
 * for one subject, no two open assertions may overlap in valid_time. This module
 * is the in-memory twin of that constraint, and the property tests hold both to
 * the same invariants.
 */

import { closeAt, contains, isOpen, overlaps, range, type Instant, type Range } from "./time";

export interface Version<T> {
  /** Stable identity of this physical row (caller-supplied, deterministic). */
  readonly id: string;
  readonly validRange: Range;
  readonly transactionRange: Range;
  readonly value: T;
}

/** An append-only set of versions for one subject. */
export type BitemporalLog<T> = ReadonlyArray<Version<T>>;

export function emptyLog<T>(): BitemporalLog<T> {
  return [];
}

/**
 * Record a new belief valid over `validRange`. Any currently-open assertion that
 * overlaps it in valid_time is closed at `now`; the new version is appended open.
 * Pure — `now` and `id` come from the caller, never from the clock.
 */
export function assert<T>(
  log: BitemporalLog<T>,
  validRange: Range,
  value: T,
  opts: { now: Instant; id: string },
): BitemporalLog<T> {
  const closed = log.map((v) =>
    isOpen(v.transactionRange) && overlaps(v.validRange, validRange)
      ? { ...v, transactionRange: closeAt(v.transactionRange, opts.now) }
      : v,
  );
  const next: Version<T> = {
    id: opts.id,
    validRange,
    transactionRange: range(opts.now, null),
    value,
  };
  return [...closed, next];
}

/** Versions the system still believed as of `knownAsOf` (open at that instant). */
export function knownAt<T>(log: BitemporalLog<T>, knownAsOf: Instant): Version<T>[] {
  return log.filter((v) => contains(v.transactionRange, knownAsOf));
}

/** Of a version set, those whose valid_time covers `validAsOf`. */
export function validAt<T>(versions: readonly Version<T>[], validAsOf: Instant): Version<T>[] {
  return versions.filter((v) => contains(v.validRange, validAsOf));
}

/** Full bitemporal point query: believed as of `knownAsOf`, true at `validAsOf`. */
export function projectAsOf<T>(
  log: BitemporalLog<T>,
  validAsOf: Instant,
  knownAsOf: Instant,
): Version<T>[] {
  return validAt(knownAt(log, knownAsOf), validAsOf);
}

/** Versions believed as of `knownAsOf` whose valid_time touches `window`. */
export function knownOverWindow<T>(
  log: BitemporalLog<T>,
  window: Range,
  knownAsOf: Instant,
): Version<T>[] {
  return knownAt(log, knownAsOf).filter((v) => overlaps(v.validRange, window));
}

/** How many open assertions overlap `validRange` — must stay ≤ 1 by construction. */
export function openOverlapCount<T>(log: BitemporalLog<T>, validRange: Range): number {
  return log.filter((v) => isOpen(v.transactionRange) && overlaps(v.validRange, validRange)).length;
}
