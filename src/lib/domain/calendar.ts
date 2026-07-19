/**
 * Brazilian civil calendar helpers. Tariff periods (ponta/intermediário/fora-
 * ponta) are defined in local wall-clock hours, holidays in local dates, and a
 * billing cycle is a local month — so every rule needs the local view of a UTC
 * instant, not the UTC one.
 *
 * Brazil dropped daylight saving in 2019, so BRT is a fixed UTC−03:00. Fixing
 * the offset (rather than pulling in a tz database) keeps the whole core a pure,
 * dependency-free function — the price of that is this code would need revisiting
 * if DST ever returns, which is called out here on purpose.
 */

import type { Instant } from "./time";

export const BRT_OFFSET_MINUTES = -180;
const OFFSET_MS = BRT_OFFSET_MINUTES * 60_000;

export interface LocalParts {
  readonly year: number;
  /** 1–12. */
  readonly month: number;
  readonly day: number;
  /** 0 = Sunday … 6 = Saturday. */
  readonly weekday: number;
  /** 0–23, local. */
  readonly hour: number;
  readonly minute: number;
}

/** Local (BRT) civil components of a UTC instant. */
export function localParts(t: Instant): LocalParts {
  const d = new Date(t + OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** The UTC instant for a BRT wall-clock date/time. */
export function fromLocalParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Instant {
  return Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS;
}

/** True on Saturday or Sunday, local time. */
export function isWeekend(parts: LocalParts): boolean {
  return parts.weekday === 0 || parts.weekday === 6;
}
