/**
 * A double-entry ledger. The whole point is one invariant: the signed amounts of
 * every transaction sum to zero, and therefore so does the entire book. `entry`
 * refuses to build an unbalanced transaction, so an unbalanced state is
 * unrepresentable rather than merely discouraged — the property tests then push
 * thousands of out-of-order, duplicated and corrected sequences through it and
 * assert the balance never leaves zero.
 *
 * Amounts are integer cents (see money.ts): integer addition is exact and order-
 * independent, which is what lets "converges to the same balance regardless of
 * arrival order" be a theorem here and not a hope.
 */

import { add, ZERO, type Money } from "../money";
import type { Instant } from "../time";
import type { AccountId } from "./accounts";

export interface LedgerEntry {
  readonly id: string;
  readonly transactionId: string;
  readonly account: AccountId;
  /** Signed: a debit is positive, a credit is negative. */
  readonly amount: Money;
  /** Transaction time — when the posting was recorded. */
  readonly at: Instant;
  readonly memo: string;
}

/** One leg of a transaction before it is stamped with ids and a timestamp. */
export interface Leg {
  readonly account: AccountId;
  readonly amount: Money;
  readonly memo: string;
}

export const debit = (account: AccountId, amount: Money, memo: string): Leg => ({
  account,
  amount,
  memo,
});

export const credit = (account: AccountId, amount: Money, memo: string): Leg => ({
  account,
  amount: -amount,
  memo,
});

/**
 * Turn balanced legs into ledger entries. Throws if they do not sum to zero —
 * an unbalanced transaction must never reach the book. Ids are derived from the
 * caller-supplied `transactionId` so the result is deterministic.
 */
export function entry(transactionId: string, at: Instant, legs: readonly Leg[]): LedgerEntry[] {
  const sum = add(...legs.map((l) => l.amount));
  if (sum !== ZERO) {
    throw new Error(`unbalanced transaction ${transactionId}: legs sum to ${sum}, not 0`);
  }
  return legs.map((leg, i) => ({
    id: `${transactionId}:${i}`,
    transactionId,
    account: leg.account,
    amount: leg.amount,
    at,
    memo: leg.memo,
  }));
}

/** Signed balance of one account across the given entries. */
export function balanceOf(entries: readonly LedgerEntry[], account: AccountId): Money {
  return add(...entries.filter((e) => e.account === account).map((e) => e.amount));
}

/** Signed balance of the whole book — zero for any consistent ledger. */
export function totalBalance(entries: readonly LedgerEntry[]): Money {
  return add(...entries.map((e) => e.amount));
}

/** True when the book balances to zero. */
export function isBalanced(entries: readonly LedgerEntry[]): boolean {
  return totalBalance(entries) === ZERO;
}

/** Per-account balances, for a trial-balance style view. */
export function trialBalance(entries: readonly LedgerEntry[]): Record<AccountId, Money> {
  const out = {} as Record<AccountId, Money>;
  for (const e of entries) {
    out[e.account] = (out[e.account] ?? 0) + e.amount;
  }
  return out;
}
