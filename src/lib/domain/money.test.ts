import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { add, applyRate, formatBRL, negate, priceLine, reais, ZERO } from "./money";

describe("priceLine rounds to a real cent, deterministically", () => {
  it("rounds half away from zero", () => {
    expect(priceLine(1, 0.005)).toBe(1); // 0.5 cent → 1
    expect(priceLine(1, 0.004)).toBe(0);
    expect(priceLine(10, 0.52109)).toBe(521); // 5.2109 → 521 cents
  });

  it("produces integers for any quantity and rate", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
        (kwh, rate) => {
          expect(Number.isInteger(priceLine(kwh, rate))).toBe(true);
        },
      ),
    );
  });
});

describe("integer money adds exactly and order-independently", () => {
  it("gives the same sum for any permutation", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), { maxLength: 100 }), (xs) => {
        const forward = add(...xs);
        const backward = add(...[...xs].reverse());
        expect(forward).toBe(backward);
      }),
    );
  });
});

describe("helpers", () => {
  it("builds amounts and applies rates", () => {
    expect(reais(12, 34)).toBe(1234);
    expect(reais(0)).toBe(ZERO);
    expect(negate(1234)).toBe(-1234);
    expect(applyRate(1000, 0.3)).toBe(300);
  });

  it("formats as Brazilian Real", () => {
    // Non-breaking spaces in the locale output — assert on the digits.
    expect(formatBRL(123456).replace(/\s/g, " ")).toMatch(/R\$\s?1\.234,56/);
  });
});
