/**
 * The billing engine: the pure state machine that ties ingestion, versioned
 * tariff/flag, invoicing, retroactive reconciliation, the ledger and the outbox
 * together. Every operation is `(state, …args, now) → { state, … }` with no clock
 * and no randomness — ids are derived from a monotonic `seq` — so a replay of the
 * same command sequence yields byte-identical state. That is what the property
 * tests exploit to prove convergence and idempotency.
 *
 * State is treated as immutable: operations return a new state, never mutate the
 * argument. Invoices and adjustment notes, once in the state, are never edited —
 * a correction always appears as a new adjustment.
 */

import { assert as assertVersion, projectAsOf, type BitemporalLog } from "../bitemporal";
import { entry, type LedgerEntry } from "../ledger";
import { credit, debit } from "../ledger/ledger";
import type { Instant } from "../time";
import { cycleKey, cycleRange, type BillingCycle, type MeterId, type Reading } from "../types";
import { DEFAULT_WHITE_TARIFF, flagLabel, type FlagColor, type TariffRuleset } from "../tariff";
import {
  addRecognised,
  adjustmentLegs,
  diffAgainst,
  isZeroDelta,
  recognisedFrom,
  type AdjustmentNote,
  type IssuedInvoice,
  type Recognised,
} from "./adjustment";
import { computeInvoice, type ComputedInvoice } from "./invoice";
import {
  emptyReadings,
  ingestReading,
  readingsForCycle,
  type IngestOutcome,
  type ReadingsState,
} from "./readings";

export type OutboxEventType =
  | "reading.ingested"
  | "flag.declared"
  | "invoice.issued"
  | "adjustment.issued";

export interface OutboxEvent {
  readonly id: string;
  readonly type: OutboxEventType;
  readonly at: Instant;
  readonly ref: string;
  readonly summary: string;
  readonly published: boolean;
}

export interface BillingState {
  readonly meterId: MeterId;
  readonly tariff: TariffRuleset;
  readonly readings: ReadingsState;
  readonly flags: BitemporalLog<FlagColor>;
  readonly invoices: readonly IssuedInvoice[];
  readonly adjustments: readonly AdjustmentNote[];
  /** Amount recognised per invoice id — original plus every adjustment posted. */
  readonly recognised: Readonly<Record<string, Recognised>>;
  readonly entries: readonly LedgerEntry[];
  readonly outbox: readonly OutboxEvent[];
  /** Monotonic counter behind every generated id — the only source of "identity". */
  readonly seq: number;
}

export function createBillingState(meterId: MeterId, tariff: TariffRuleset = DEFAULT_WHITE_TARIFF): BillingState {
  return {
    meterId,
    tariff,
    readings: emptyReadings(),
    flags: [],
    invoices: [],
    adjustments: [],
    recognised: {},
    entries: [],
    outbox: [],
    seq: 0,
  };
}

function emit(state: BillingState, type: OutboxEventType, at: Instant, ref: string, summary: string): OutboxEvent {
  return { id: `evt-${state.seq}`, type, at, ref, summary, published: false };
}

export interface IngestResult {
  readonly state: BillingState;
  readonly outcome: IngestOutcome;
}

/** Ingest one reading. Duplicates are true no-ops; corrections supersede. */
export function ingest(state: BillingState, reading: Reading, now: Instant): IngestResult {
  const result = ingestReading(state.readings, reading, { now, id: `rd-${state.seq}` });
  if (result.outcome === "duplicate") {
    return { state, outcome: "duplicate" };
  }
  const event = emit(state, "reading.ingested", now, reading.idempotencyKey, `${reading.kwh} kWh @ ${state.meterId}`);
  return {
    state: {
      ...state,
      readings: result.state,
      outbox: [...state.outbox, event],
      seq: state.seq + 1,
    },
    outcome: result.outcome,
  };
}

/** Declare the flag colour in force for a cycle. Retroactive changes are allowed. */
export function declareFlag(state: BillingState, cycle: BillingCycle, color: FlagColor, now: Instant): BillingState {
  const flags = assertVersion(state.flags, cycleRange(cycle), color, { now, id: `fl-${state.seq}` });
  const event = emit(state, "flag.declared", now, cycleKey(cycle), `${cycleKey(cycle)} → ${flagLabel(color)}`);
  return { ...state, flags, outbox: [...state.outbox, event], seq: state.seq + 1 };
}

/** The flag colour believed for a cycle as of `knownAsOf` (green if undeclared). */
export function flagFor(state: BillingState, cycle: BillingCycle, knownAsOf: Instant): FlagColor {
  const versions = projectAsOf(state.flags, cycleRange(cycle).start, knownAsOf);
  return versions.at(-1)?.value ?? "green";
}

/** Compute a cycle's invoice as it was known at `knownAsOf` — the "as-of" query. */
export function invoiceAsOf(state: BillingState, cycle: BillingCycle, knownAsOf: Instant): ComputedInvoice {
  return computeInvoice({
    meterId: state.meterId,
    cycle,
    readings: readingsForCycle(state.readings.log, cycle, knownAsOf),
    tariff: state.tariff,
    flagColor: flagFor(state, cycle, knownAsOf),
  });
}

function invoiceForCycle(state: BillingState, cycle: BillingCycle): IssuedInvoice | undefined {
  return state.invoices.find((inv) => cycleKey(inv.cycle) === cycleKey(cycle));
}

export interface IssueResult {
  readonly state: BillingState;
  readonly invoice: IssuedInvoice | null;
}

/**
 * Cut the invoice for a cycle from what is known now, posting the balanced
 * receivable/revenue/tax transaction. A cycle is invoiced once; a later change is
 * reconciled, not re-issued.
 */
export function issueInvoice(state: BillingState, cycle: BillingCycle, now: Instant): IssueResult {
  if (invoiceForCycle(state, cycle)) {
    return { state, invoice: null };
  }
  const computed = invoiceAsOf(state, cycle, now);
  const id = `inv-${state.seq}`;
  const invoice: IssuedInvoice = {
    id,
    meterId: state.meterId,
    cycle,
    computed,
    issuedAt: now,
    knownAsOf: now,
  };
  const legs = [
    debit("receivable", computed.totalCents, `Fatura ${id}`),
    credit("energy_revenue", computed.energyCents, `Fatura ${id}`),
    credit("flag_surcharge", computed.flagCents, `Fatura ${id}`),
    credit("tax_payable", computed.taxCents, `Fatura ${id}`),
  ];
  const event = emit(state, "invoice.issued", now, id, `${cycleKey(cycle)} · ${computed.totalCents}`);
  return {
    state: {
      ...state,
      invoices: [...state.invoices, invoice],
      recognised: { ...state.recognised, [id]: recognisedFrom(invoice) },
      entries: [...state.entries, ...entry(id, now, legs)],
      outbox: [...state.outbox, event],
      seq: state.seq + 1,
    },
    invoice,
  };
}

export interface ReconcileResult {
  readonly state: BillingState;
  readonly note: AdjustmentNote | null;
}

/**
 * Recompute an already-issued cycle against what is known now and, if it differs
 * from what is recognised, issue an adjustment note for the delta. The original
 * invoice is never touched.
 */
export function reconcile(state: BillingState, cycle: BillingCycle, now: Instant): ReconcileResult {
  const invoice = invoiceForCycle(state, cycle);
  if (!invoice) return { state, note: null };

  const revised = invoiceAsOf(state, cycle, now);
  const recognised = state.recognised[invoice.id] ?? recognisedFrom(invoice);
  const delta = diffAgainst(revised, recognised);
  if (isZeroDelta(delta)) return { state, note: null };

  const id = `adj-${state.seq}`;
  const note: AdjustmentNote = {
    id,
    invoiceId: invoice.id,
    meterId: state.meterId,
    cycle,
    revised,
    delta,
    issuedAt: now,
    knownAsOf: now,
  };
  const event = emit(state, "adjustment.issued", now, id, `${cycleKey(cycle)} Δ ${delta.totalCents}`);
  return {
    state: {
      ...state,
      adjustments: [...state.adjustments, note],
      recognised: { ...state.recognised, [invoice.id]: addRecognised(recognised, delta) },
      entries: [...state.entries, ...entry(id, now, adjustmentLegs(delta, `Ajuste ${id} · fatura ${invoice.id}`))],
      outbox: [...state.outbox, event],
      seq: state.seq + 1,
    },
    note,
  };
}

/** Mark every pending outbox event published — the in-memory twin of the relay. */
export function drainOutbox(state: BillingState): { state: BillingState; drained: OutboxEvent[] } {
  const drained = state.outbox.filter((e) => !e.published);
  if (drained.length === 0) return { state, drained: [] };
  return {
    state: { ...state, outbox: state.outbox.map((e) => (e.published ? e : { ...e, published: true })) },
    drained,
  };
}

export function pendingOutbox(state: BillingState): OutboxEvent[] {
  return state.outbox.filter((e) => !e.published);
}
