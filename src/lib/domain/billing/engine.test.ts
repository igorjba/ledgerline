import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../rng";
import { fromLocalParts } from "../calendar";
import { isBalanced, totalBalance, trialBalance } from "../ledger";
import type { Reading } from "../types";
import {
  createBillingState,
  declareFlag,
  drainOutbox,
  ingest,
  invoiceAsOf,
  issueInvoice,
  pendingOutbox,
  reconcile,
  type BillingState,
} from "./engine";

const METER = "MTR-0001";
const CYCLE = { year: 2026, month: 7 } as const;
const MONTH_START = fromLocalParts(2026, 7, 1);
const AFTER_CYCLE = fromLocalParts(2026, 8, 1);
// Well after every reading is ingested, so the invoice "knows" all of them
// regardless of arrival order — the whole point of the transaction-time axis.
const ISSUE_NOW = fromLocalParts(2027, 1, 1);

/** Distinct, non-overlapping hourly intervals — every reading is its own slot. */
function reading(i: number, kwh: number): Reading {
  const start = MONTH_START + i * 3_600_000;
  return {
    idempotencyKey: `k-${i}`,
    meterId: METER,
    periodStart: start,
    periodEnd: start + 3_600_000,
    kwh,
    source: "ami",
  };
}

/** Feed a delivery order (indices into `readings`) through the engine. */
function deliver(readings: Reading[], order: readonly number[], startNow: number): BillingState {
  let state = createBillingState(METER);
  let now = startNow;
  for (const idx of order) {
    state = ingest(state, readings[idx]!, now).state;
    now += 1000;
  }
  return state;
}

describe("idempotent, out-of-order ingestion converges", () => {
  it("reaches the same invoice and ledger no matter the arrival order or duplicates", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5000 }), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        (kwhInts, seed) => {
          const readings = kwhInts.map((g, i) => reading(i, g / 100));
          const indices = readings.map((_, i) => i);

          // Reference: each reading once, in canonical order.
          const reference = issueInvoice(deliver(readings, indices, AFTER_CYCLE), CYCLE, ISSUE_NOW);

          // A shuffled delivery with extra duplicates, driven by the seed.
          const rng = mulberry32(seed);
          const shuffled = shuffle(indices, rng);
          const duplicates = indices.filter(() => rng() < 0.5);
          const order = interleave(shuffled, duplicates, rng);

          const scrambled = issueInvoice(deliver(readings, order, AFTER_CYCLE), CYCLE, ISSUE_NOW);

          expect(scrambled.invoice!.computed.totalCents).toBe(reference.invoice!.computed.totalCents);
          expect(trialBalance(scrambled.state.entries)).toEqual(trialBalance(reference.state.entries));
        },
      ),
    );
  });

  it("re-delivering the same key never moves the ledger and reports a duplicate", () => {
    const r = reading(0, 12.5);
    let state = ingest(createBillingState(METER), r, AFTER_CYCLE).state;
    state = issueInvoice(state, CYCLE, AFTER_CYCLE).state;
    const before = trialBalance(state.entries);

    for (let i = 0; i < 5; i++) {
      const res = ingest(state, r, AFTER_CYCLE + i);
      expect(res.outcome).toBe("duplicate");
      state = res.state;
    }
    expect(trialBalance(state.entries)).toEqual(before);
  });
});

describe("the ledger balances to zero under any command sequence", () => {
  it("stays balanced across ingest, issue, flag changes and reconciliation", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ op: fc.constant("ingest" as const), i: fc.nat({ max: 20 }), kwh: fc.integer({ min: 1, max: 4000 }) }),
            fc.record({ op: fc.constant("issue" as const) }),
            fc.record({ op: fc.constant("reconcile" as const) }),
            fc.record({ op: fc.constant("flag" as const), color: fc.constantFrom("green", "yellow", "red1", "red2") }),
          ),
          { minLength: 1, maxLength: 40 },
        ),
        (commands) => {
          let state = createBillingState(METER);
          let now = AFTER_CYCLE;
          for (const cmd of commands) {
            if (cmd.op === "ingest") state = ingest(state, reading(cmd.i, cmd.kwh / 100), now).state;
            else if (cmd.op === "issue") state = issueInvoice(state, CYCLE, now).state;
            else if (cmd.op === "reconcile") state = reconcile(state, CYCLE, now).state;
            else state = declareFlag(state, CYCLE, cmd.color, now);
            now += 1000;
            // The invariant must hold after *every* step, not just at the end.
            expect(totalBalance(state.entries)).toBe(0);
          }
          expect(isBalanced(state.entries)).toBe(true);
        },
      ),
    );
  });
});

describe("bitemporal as-of reproduces past invoices", () => {
  it("reconstructs the invoice as it was known before a correction", () => {
    const t1 = AFTER_CYCLE;
    let state = ingest(createBillingState(METER), reading(0, 100), t1).state;
    const issued = issueInvoice(state, CYCLE, t1);
    state = issued.state;
    const originalTotal = issued.invoice!.computed.totalCents;

    // A correction arrives later: the same interval, twice the energy.
    const t2 = t1 + 86_400_000;
    const correction: Reading = { ...reading(0, 200), idempotencyKey: "k-0-fix" };
    state = ingest(state, correction, t2).state;

    // As known at t1, the invoice is unchanged; as known now, it doubled.
    expect(invoiceAsOf(state, CYCLE, t1).totalCents).toBe(originalTotal);
    expect(invoiceAsOf(state, CYCLE, t2).totalCents).toBeGreaterThan(originalTotal);
    // The issued document itself was never mutated.
    expect(state.invoices[0]!.computed.totalCents).toBe(originalTotal);
  });
});

describe("retroactive reconciliation issues an adjustment, never an edit", () => {
  it("posts the delta and leaves the original invoice intact", () => {
    const t1 = AFTER_CYCLE;
    let state = ingest(createBillingState(METER), reading(0, 100), t1).state;
    state = issueInvoice(state, CYCLE, t1).state;
    const original = state.invoices[0]!.computed.totalCents;

    const t2 = t1 + 86_400_000;
    state = ingest(state, { ...reading(0, 250), idempotencyKey: "k-0-fix" }, t2).state;
    const res = reconcile(state, CYCLE, t2);
    state = res.state;

    expect(res.note).not.toBeNull();
    expect(state.invoices).toHaveLength(1); // no second invoice
    expect(state.invoices[0]!.computed.totalCents).toBe(original); // original frozen
    expect(res.note!.delta.totalCents).toBeGreaterThan(0);
    expect(isBalanced(state.entries)).toBe(true);

    // Recognised amount now equals the revised invoice, via original + adjustment.
    const revised = invoiceAsOf(state, CYCLE, t2).totalCents;
    expect(state.recognised[state.invoices[0]!.id]!.totalCents).toBe(revised);
  });

  it("is a no-op when nothing changed", () => {
    const t1 = AFTER_CYCLE;
    let state = ingest(createBillingState(METER), reading(0, 100), t1).state;
    state = issueInvoice(state, CYCLE, t1).state;
    const res = reconcile(state, CYCLE, t1 + 1000);
    expect(res.note).toBeNull();
    expect(state.adjustments).toHaveLength(0);
  });
});

describe("a reading is billed in exactly one cycle", () => {
  it("assigns a month-boundary reading to the cycle of its start, never both", () => {
    const jan = { year: 2026, month: 1 } as const;
    const feb = { year: 2026, month: 2 } as const;
    const crossing: Reading = {
      idempotencyKey: "cross",
      meterId: METER,
      periodStart: fromLocalParts(2026, 1, 31, 23), // 31 Jan 23:00 BRT
      periodEnd: fromLocalParts(2026, 2, 1, 1), //     01 Feb 01:00 BRT
      kwh: 4,
      source: "ami",
    };
    const now = fromLocalParts(2026, 3, 1);
    const state = ingest(createBillingState(METER), crossing, now).state;

    // It belongs to January (which contains its start) and is not double-counted.
    expect(invoiceAsOf(state, jan, now).kwh).toBe(4);
    expect(invoiceAsOf(state, feb, now).kwh).toBe(0);
  });
});

describe("outbox", () => {
  it("records an event per mutation and drains each exactly once", () => {
    let state = ingest(createBillingState(METER), reading(0, 100), AFTER_CYCLE).state;
    state = issueInvoice(state, CYCLE, AFTER_CYCLE).state;
    expect(pendingOutbox(state)).toHaveLength(2);

    const drained = drainOutbox(state);
    expect(drained.drained).toHaveLength(2);
    expect(pendingOutbox(drained.state)).toHaveLength(0);
    // Draining again finds nothing new.
    expect(drainOutbox(drained.state).drained).toHaveLength(0);
  });
});

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function interleave(a: readonly number[], b: readonly number[], rng: () => number): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && rng() < 0.6)) out.push(a[i++]!);
    else out.push(b[j++]!);
  }
  return out;
}
