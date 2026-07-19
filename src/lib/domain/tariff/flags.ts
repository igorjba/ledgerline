/**
 * Tariff flags (bandeiras tarifárias). ANEEL sets a per-kWh surcharge each month
 * to signal the cost of generation: green is free, yellow and the two red tiers
 * add progressively. The colour in force is versioned month by month and lives
 * in its own bitemporal log, because a flag can be re-declared retroactively —
 * exactly the case that must reprice already-issued invoices without touching
 * them.
 */

export type FlagColor = "green" | "yellow" | "red1" | "red2";

export const FLAG_COLORS: readonly FlagColor[] = ["green", "yellow", "red1", "red2"];

/** Per-kWh surcharge in R$/kWh. Defaults are ANEEL's 2024 published values. */
export type FlagRates = Record<FlagColor, number>;

export const DEFAULT_FLAG_RATES: FlagRates = {
  green: 0,
  yellow: 0.01885,
  red1: 0.04463,
  red2: 0.07877,
};

const LABELS: Record<FlagColor, string> = {
  green: "Verde",
  yellow: "Amarela",
  red1: "Vermelha P1",
  red2: "Vermelha P2",
};

export function flagLabel(color: FlagColor): string {
  return LABELS[color];
}

export function flagSurchargeRate(color: FlagColor, rates: FlagRates = DEFAULT_FLAG_RATES): number {
  return rates[color];
}
