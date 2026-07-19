import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { balanceOf, credit, debit, entry, isBalanced, totalBalance } from "./ledger";
import type { AccountId } from "./accounts";

describe("entry refuses to build an unbalanced transaction", () => {
  it("throws when the legs do not sum to zero", () => {
    expect(() => entry("t1", 0, [debit("receivable", 100, "x"), credit("energy_revenue", 90, "x")])).toThrow(
      /unbalanced/,
    );
  });

  it("accepts a balanced transaction and preserves the signed amounts", () => {
    const entries = entry("t1", 0, [
      debit("receivable", 130, "invoice"),
      credit("energy_revenue", 100, "invoice"),
      credit("tax_payable", 30, "invoice"),
    ]);
    expect(totalBalance(entries)).toBe(0);
    expect(balanceOf(entries, "receivable")).toBe(130);
    expect(balanceOf(entries, "energy_revenue")).toBe(-100);
  });
});

describe("the book stays at zero regardless of posting order", () => {
  it("sums to zero after any interleaving of balanced transactions", () => {
    const accounts: AccountId[] = ["receivable", "energy_revenue", "flag_surcharge", "tax_payable", "adjustments"];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 6 }),
            a: fc.constantFrom(...accounts),
            b: fc.constantFrom(...accounts),
            amount: fc.integer({ min: -100000, max: 100000 }),
          }),
          { minLength: 1, maxLength: 60 },
        ),
        (txs) => {
          const entries = txs.flatMap((t, i) =>
            t.a === t.b
              ? []
              : entry(`${t.id}-${i}`, i, [debit(t.a, t.amount, "x"), credit(t.b, t.amount, "x")]),
          );
          expect(isBalanced(entries)).toBe(true);
        },
      ),
    );
  });
});
