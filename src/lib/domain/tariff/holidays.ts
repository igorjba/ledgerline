/**
 * Brazilian national holidays for a given year — the fixed dates plus the moving
 * ones anchored to Easter. On these dates the tariff drops to off-peak all day,
 * which is why "feriado móvel" is a billing concern and not just a calendar note.
 *
 * The moving holidays are *derived data*: Carnaval, Sexta-feira Santa and Corpus
 * Christi are pure functions of Easter Sunday, and Easter is computed with the
 * anonymous Gregorian algorithm (Meeus/Jones/Butcher) — no lookup table, valid
 * for any Gregorian year.
 */

import { localParts, type LocalParts } from "../calendar";
import type { Instant } from "../time";

/** Easter Sunday for a Gregorian year, as (month, day). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

type MMDD = string; // "MM-DD"

const key = (month: number, day: number): MMDD =>
  `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Add `days` to a (month, day) within a year and return its "MM-DD" key. */
function shift(year: number, month: number, day: number, days: number): MMDD {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return key(d.getUTCMonth() + 1, d.getUTCDate());
}

const FIXED: readonly MMDD[] = [
  "01-01", // Confraternizacao Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independencia
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamacao da Republica
  "12-25", // Natal
];

/** The set of holiday "MM-DD" keys for a year, fixed plus Easter-derived. */
export function holidayCalendar(year: number): ReadonlySet<MMDD> {
  const easter = easterSunday(year);
  const moving = [
    shift(year, easter.month, easter.day, -47), // Carnaval (terca)
    shift(year, easter.month, easter.day, -2), //  Sexta-feira Santa
    shift(year, easter.month, easter.day, 60), //  Corpus Christi
  ];
  return new Set([...FIXED, ...moving]);
}

/** Whether a local date is a national holiday. */
export function isHolidayLocal(parts: LocalParts): boolean {
  return holidayCalendar(parts.year).has(key(parts.month, parts.day));
}

/** Whether a UTC instant falls on a Brazilian national holiday, local time. */
export function isHoliday(t: Instant): boolean {
  return isHolidayLocal(localParts(t));
}
