/**
 * The tariff ruleset — the versioned bundle of numbers a price is derived from:
 * an energy rate per period, the hour windows that define those periods, and the
 * effective tax rate applied on top. The ruleset is the *data* behind pricing; a
 * new rate schedule is a new bitemporal version, never an edit, so any past
 * invoice can be recomputed against the schedule that was in force when it was
 * cut.
 */

import { priceLine, type Money } from "../money";
import type { Reading } from "../types";
import { classifyPeriod, DEFAULT_WINDOWS, type PeriodWindows, type TariffPeriod } from "./periods";
import { DEFAULT_FLAG_RATES, flagSurchargeRate, type FlagColor, type FlagRates } from "./flags";

export interface TariffRuleset {
  readonly energyRates: Record<TariffPeriod, number>;
  readonly windows: PeriodWindows;
  /** Combined effective tax rate (ICMS + PIS/COFINS), as a fraction of 0–1. */
  readonly taxRate: number;
}

/** A representative white-tariff schedule; used to seed the demo and the tests. */
export const DEFAULT_WHITE_TARIFF: TariffRuleset = {
  energyRates: { peak: 1.24738, intermediate: 0.78214, offpeak: 0.52109 },
  windows: DEFAULT_WINDOWS,
  taxRate: 0.3,
};

/** One priced consumption line — the audit-grade breakdown behind a charge. */
export interface PricedLine {
  readonly period: TariffPeriod;
  readonly kwh: number;
  readonly energyRate: number;
  readonly flagColor: FlagColor;
  readonly flagRate: number;
  readonly energyCents: Money;
  readonly flagCents: Money;
}

/**
 * Price one reading against a ruleset and the flag in force. Rounding to a real
 * cent happens exactly here (via `priceLine`), so the ledger only ever sees
 * integers and the double-entry balance is exact.
 */
export function priceReading(
  reading: Reading,
  ruleset: TariffRuleset,
  flagColor: FlagColor,
  flagRates: FlagRates = DEFAULT_FLAG_RATES,
): PricedLine {
  const period = classifyPeriod(reading.periodStart, ruleset.windows);
  const energyRate = ruleset.energyRates[period];
  const flagRate = flagSurchargeRate(flagColor, flagRates);
  return {
    period,
    kwh: reading.kwh,
    energyRate,
    flagColor,
    flagRate,
    energyCents: priceLine(reading.kwh, energyRate),
    flagCents: priceLine(reading.kwh, flagRate),
  };
}
