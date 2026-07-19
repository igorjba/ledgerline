/**
 * Invoice computation — a pure function from a set of readings (already projected
 * to a point in bitemporal time) plus the tariff and flag in force, to a priced
 * invoice. No state, no clock: feed it the readings the system believed at some
 * `knownAsOf` and it reproduces exactly the invoice that would have been cut then.
 * That reproducibility is the whole "as-of" guarantee, expressed as a function.
 *
 * Every line is rounded to a real cent as it is priced (money.ts), and the totals
 * are sums of those integers, so `energy + flag + tax === total` holds exactly and
 * the ledger transaction it feeds is balanced by construction.
 */

import { add, applyRate, type Money, ZERO } from "../money";
import { priceReading, TARIFF_PERIODS, type FlagColor, type FlagRates, type TariffPeriod, type TariffRuleset } from "../tariff";
import { contains } from "../time";
import { cycleRange, type BillingCycle, type MeterId, type Reading } from "../types";

export interface InvoiceLine {
  readonly period: TariffPeriod;
  readonly kwh: number;
  readonly energyRate: number;
  readonly energyCents: Money;
}

export interface ComputedInvoice {
  readonly meterId: MeterId;
  readonly cycle: BillingCycle;
  readonly lines: readonly InvoiceLine[];
  readonly flagColor: FlagColor;
  readonly kwh: number;
  readonly energyCents: Money;
  readonly flagCents: Money;
  readonly subtotalCents: Money;
  readonly taxCents: Money;
  readonly totalCents: Money;
}

export interface InvoiceInput {
  readonly meterId: MeterId;
  readonly cycle: BillingCycle;
  readonly readings: readonly Reading[];
  readonly tariff: TariffRuleset;
  readonly flagColor: FlagColor;
  readonly flagRates?: FlagRates;
}

export function computeInvoice(input: InvoiceInput): ComputedInvoice {
  // A reading belongs to the cycle that contains its start instant, so a reading
  // straddling a month boundary is billed in exactly one cycle — never twice.
  // Enforced here, at the single pricing point, so every caller (the engine and
  // the invoices API alike) is protected, not only those that pre-filter.
  const window = cycleRange(input.cycle);
  const priced = input.readings
    .filter((r) => contains(window, r.periodStart))
    .map((r) => priceReading(r, input.tariff, input.flagColor, input.flagRates));

  const byPeriod = new Map<TariffPeriod, { kwh: number; energyCents: Money; rate: number }>();
  for (const line of priced) {
    const bucket = byPeriod.get(line.period) ?? { kwh: 0, energyCents: ZERO, rate: line.energyRate };
    byPeriod.set(line.period, {
      kwh: bucket.kwh + line.kwh,
      energyCents: bucket.energyCents + line.energyCents,
      rate: line.energyRate,
    });
  }

  // Stable ordering: peak → intermediate → off-peak, empty periods omitted. kWh is
  // rounded to a milli-kWh per line so the invoice total is exactly the sum of the
  // lines shown, not a separately-rounded figure that could disagree with them.
  const lines: InvoiceLine[] = TARIFF_PERIODS.flatMap((period) => {
    const bucket = byPeriod.get(period);
    if (!bucket) return [];
    return [{ period, kwh: Math.round(bucket.kwh * 1000) / 1000, energyRate: bucket.rate, energyCents: bucket.energyCents }];
  });

  const energyCents = add(...priced.map((l) => l.energyCents));
  const flagCents = add(...priced.map((l) => l.flagCents));
  const subtotalCents = energyCents + flagCents;
  const taxCents = applyRate(subtotalCents, input.tariff.taxRate);
  const totalCents = subtotalCents + taxCents;

  return {
    meterId: input.meterId,
    cycle: input.cycle,
    lines,
    flagColor: input.flagColor,
    kwh: lines.reduce((sum, l) => sum + l.kwh, 0),
    energyCents,
    flagCents,
    subtotalCents,
    taxCents,
    totalCents,
  };
}
