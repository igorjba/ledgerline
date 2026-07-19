/**
 * Tariff periods for the white tariff (tarifa branca): peak (ponta), intermediate
 * (intermediário) and off-peak (fora-ponta). Which period an instant falls in is
 * *data, not an `if`* — the peak and intermediate hour windows are carried on the
 * ruleset, so a distributor with different windows is a different row, not a code
 * change. Weekends and national holidays are off-peak all day.
 */

import { isWeekend, localParts } from "../calendar";
import type { Instant } from "../time";
import { isHoliday } from "./holidays";

export type TariffPeriod = "peak" | "intermediate" | "offpeak";

export const TARIFF_PERIODS: readonly TariffPeriod[] = ["peak", "intermediate", "offpeak"];

/** Local-hour window `[startHour, endHour)`, 0–24. */
export interface HourWindow {
  readonly startHour: number;
  readonly endHour: number;
}

export interface PeriodWindows {
  readonly peak: readonly HourWindow[];
  readonly intermediate: readonly HourWindow[];
}

/** ANEEL-style default: peak 18–21h, intermediate the hour on either side. */
export const DEFAULT_WINDOWS: PeriodWindows = {
  peak: [{ startHour: 18, endHour: 21 }],
  intermediate: [
    { startHour: 17, endHour: 18 },
    { startHour: 21, endHour: 22 },
  ],
};

function inAnyWindow(hour: number, windows: readonly HourWindow[]): boolean {
  return windows.some((w) => hour >= w.startHour && hour < w.endHour);
}

/** Classify a UTC instant into a tariff period given the ruleset's windows. */
export function classifyPeriod(t: Instant, windows: PeriodWindows): TariffPeriod {
  const parts = localParts(t);
  if (isWeekend(parts) || isHoliday(t)) return "offpeak";
  if (inAnyWindow(parts.hour, windows.peak)) return "peak";
  if (inAnyWindow(parts.hour, windows.intermediate)) return "intermediate";
  return "offpeak";
}

const LABELS: Record<TariffPeriod, string> = {
  peak: "Ponta",
  intermediate: "Intermediário",
  offpeak: "Fora-ponta",
};

/** Display label (Portuguese, ANEEL terminology). */
export function periodLabel(period: TariffPeriod): string {
  return LABELS[period];
}
