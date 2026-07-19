import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fromLocalParts, localParts } from "../calendar";
import type { Reading } from "../types";
import { easterSunday, holidayCalendar, isHoliday } from "./holidays";
import { classifyPeriod, DEFAULT_WINDOWS, TARIFF_PERIODS } from "./periods";
import { DEFAULT_WHITE_TARIFF, priceReading } from "./tariff";

describe("moving holidays derive from Easter", () => {
  it("computes Easter Sunday for known years", () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
  });

  it("places Carnaval, Sexta-feira Santa and Corpus Christi off Easter", () => {
    const cal = holidayCalendar(2026);
    expect(cal.has("02-17")).toBe(true); // Carnaval = Easter − 47
    expect(cal.has("04-03")).toBe(true); // Sexta-feira Santa = Easter − 2
    expect(cal.has("06-04")).toBe(true); // Corpus Christi = Easter + 60
  });

  it("keeps the fixed national holidays", () => {
    expect(isHoliday(fromLocalParts(2026, 12, 25, 19))).toBe(true); // Natal
    expect(isHoliday(fromLocalParts(2026, 9, 7, 12))).toBe(true); // Independencia
    expect(isHoliday(fromLocalParts(2026, 7, 15, 12))).toBe(false);
  });
});

describe("tariff period classification", () => {
  const businessDay = firstBusinessDay();

  it("maps peak, intermediate and off-peak hours on a business day", () => {
    expect(classifyPeriod(fromLocalParts(2026, 7, businessDay, 19), DEFAULT_WINDOWS)).toBe("peak");
    expect(classifyPeriod(fromLocalParts(2026, 7, businessDay, 17, 30), DEFAULT_WINDOWS)).toBe("intermediate");
    expect(classifyPeriod(fromLocalParts(2026, 7, businessDay, 10), DEFAULT_WINDOWS)).toBe("offpeak");
  });

  it("treats weekends and holidays as off-peak all day", () => {
    // Christmas at 19h — a peak hour on a business day — is off-peak.
    expect(classifyPeriod(fromLocalParts(2026, 12, 25, 19), DEFAULT_WINDOWS)).toBe("offpeak");
  });

  it("always returns one of the three periods", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 365 * 24 }), (hours) => {
        const t = fromLocalParts(2026, 1, 1) + hours * 3_600_000;
        expect(TARIFF_PERIODS).toContain(classifyPeriod(t, DEFAULT_WINDOWS));
      }),
    );
  });
});

describe("priceReading rounds each component to a cent", () => {
  it("prices a peak reading at the peak rate with no flag surcharge on green", () => {
    const businessDay = firstBusinessDay();
    const r: Reading = {
      idempotencyKey: "k",
      meterId: "M",
      periodStart: fromLocalParts(2026, 7, businessDay, 19),
      periodEnd: fromLocalParts(2026, 7, businessDay, 20),
      kwh: 10,
      source: "ami",
    };
    const line = priceReading(r, DEFAULT_WHITE_TARIFF, "green");
    expect(line.period).toBe("peak");
    expect(line.energyCents).toBe(1247); // round(10 × 1.24738 × 100)
    expect(line.flagCents).toBe(0);
  });
});

/** Find a July 2026 day that is a weekday and not a holiday. */
function firstBusinessDay(): number {
  for (let d = 6; d <= 12; d++) {
    const t = fromLocalParts(2026, 7, d, 12);
    const p = localParts(t);
    if (p.weekday !== 0 && p.weekday !== 6 && !isHoliday(t)) return d;
  }
  throw new Error("no business day found");
}
