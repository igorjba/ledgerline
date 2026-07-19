/**
 * Money is an integer number of cents (centavos, BRL). Never a float.
 *
 * Two reasons this matters and both are load-bearing here. First, a double-entry
 * ledger balances by exact equality — `debit + credit === 0` must hold for every
 * transaction and across the whole book — and floating-point addition is not
 * associative, so a few thousand out-of-order postings would drift off zero.
 * Integers add exactly regardless of order. Second, an invoice line is the price
 * per kWh (a decimal rate) times energy (a decimal), and that product has to be
 * rounded to a real, chargeable cent exactly once, deterministically, before it
 * ever reaches the ledger. `priceLine` is that single rounding point.
 */

/** An integer amount of cents. A positive value is money owed to us (a debit). */
export type Money = number;

export const ZERO: Money = 0;

/** Round a rate × quantity product to the nearest cent, deterministically. */
export function priceLine(quantity: number, ratePerUnit: number): Money {
  // Half-away-from-zero, computed on the cent-scaled product so 0.5-cent cases
  // round the same way every run and on every platform.
  return roundHalfAwayFromZero(quantity * ratePerUnit * 100);
}

/** Build a Money from a whole-reais + cents figure, e.g. `reais(12, 34)` = R$12,34. */
export function reais(whole: number, cents = 0): Money {
  return Math.trunc(whole) * 100 + Math.sign(whole || 1) * Math.abs(cents);
}

/** Apply a fractional rate (e.g. a tax) to an amount, rounded to a cent. */
export function applyRate(amount: Money, rate: number): Money {
  return roundHalfAwayFromZero(amount * rate);
}

export function add(...amounts: Money[]): Money {
  let sum = 0;
  for (const a of amounts) sum += a;
  return sum;
}

export function negate(a: Money): Money {
  return -a;
}

/** Format cents as a Brazilian Real string, e.g. `R$ 1.234,56`. */
export function formatBRL(cents: Money): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}
