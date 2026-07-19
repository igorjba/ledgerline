/**
 * Retroactive recomputation. When a reading is corrected or a flag/tariff is
 * re-declared for a month already invoiced, the invoice is *not* edited. The
 * engine recomputes what the cycle should now cost and issues an adjustment note
 * for the difference — a new immutable document that references the original.
 *
 * An adjustment posts only the delta, and against the `adjustments` revenue
 * account rather than the original energy line, so an auditor can tell first-cut
 * revenue from reprocessing at a glance. Deltas can be negative (a credit note);
 * the signed legs still sum to zero.
 */

import { credit, debit, type Leg } from "../ledger";
import type { Money } from "../money";
import type { Instant } from "../time";
import type { BillingCycle, MeterId } from "../types";
import type { ComputedInvoice } from "./invoice";

/** An issued invoice: immutable once cut. Corrections arrive as adjustments. */
export interface IssuedInvoice {
  readonly id: string;
  readonly meterId: MeterId;
  readonly cycle: BillingCycle;
  readonly computed: ComputedInvoice;
  /** Transaction time it was issued. */
  readonly issuedAt: Instant;
  /** The bitemporal snapshot (known-as-of) the figures were computed from. */
  readonly knownAsOf: Instant;
}

/** The amount currently recognised for an invoice — original plus adjustments. */
export interface Recognised {
  readonly energyCents: Money;
  readonly flagCents: Money;
  readonly taxCents: Money;
  readonly totalCents: Money;
}

export interface AdjustmentDelta {
  readonly energyCents: Money;
  readonly flagCents: Money;
  readonly taxCents: Money;
  readonly totalCents: Money;
}

export interface AdjustmentNote {
  readonly id: string;
  readonly invoiceId: string;
  readonly meterId: MeterId;
  readonly cycle: BillingCycle;
  readonly revised: ComputedInvoice;
  readonly delta: AdjustmentDelta;
  readonly issuedAt: Instant;
  readonly knownAsOf: Instant;
}

export function recognisedFrom(invoice: IssuedInvoice): Recognised {
  return {
    energyCents: invoice.computed.energyCents,
    flagCents: invoice.computed.flagCents,
    taxCents: invoice.computed.taxCents,
    totalCents: invoice.computed.totalCents,
  };
}

export function addRecognised(base: Recognised, delta: AdjustmentDelta): Recognised {
  return {
    energyCents: base.energyCents + delta.energyCents,
    flagCents: base.flagCents + delta.flagCents,
    taxCents: base.taxCents + delta.taxCents,
    totalCents: base.totalCents + delta.totalCents,
  };
}

/** The difference between a fresh recomputation and what is already recognised. */
export function diffAgainst(revised: ComputedInvoice, recognised: Recognised): AdjustmentDelta {
  return {
    energyCents: revised.energyCents - recognised.energyCents,
    flagCents: revised.flagCents - recognised.flagCents,
    taxCents: revised.taxCents - recognised.taxCents,
    totalCents: revised.totalCents - recognised.totalCents,
  };
}

/** True when nothing changed — no adjustment need be issued. */
export function isZeroDelta(delta: AdjustmentDelta): boolean {
  return delta.totalCents === 0 && delta.energyCents === 0 && delta.flagCents === 0 && delta.taxCents === 0;
}

/** Balanced ledger legs for an adjustment's delta. */
export function adjustmentLegs(delta: AdjustmentDelta, memo: string): Leg[] {
  return [
    debit("receivable", delta.totalCents, memo),
    credit("adjustments", delta.energyCents + delta.flagCents, memo),
    credit("tax_payable", delta.taxCents, memo),
  ];
}
