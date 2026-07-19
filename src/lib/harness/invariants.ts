/**
 * The in-browser invariant harness. It generates seeded, scrambled command
 * sequences — ingests (some duplicate), issues, reconciliations, flag changes —
 * and checks that the ledger sums to zero after every single step. It is the
 * runtime twin of the fast-check property suite: the console can prove the core,
 * live, rather than assert it.
 *
 * Runs synchronously in batches; the component drives it in chunks so the UI
 * stays responsive without a Web Worker.
 */

import {
  createBillingState,
  declareFlag,
  fromLocalParts,
  ingest,
  issueInvoice,
  MS_PER_HOUR,
  reconcile,
  totalBalance,
  type BillingState,
  type FlagColor,
} from "@/lib/domain";
import { DEMO_CYCLE, makeHourlyReading } from "@/lib/demo/scenario";
import { mulberry32 } from "@/lib/rng";

const CYCLE = DEMO_CYCLE;
const START_NOW = fromLocalParts(2026, 8, 1);
const FLAGS: FlagColor[] = ["green", "yellow", "red1", "red2"];

export interface HarnessResult {
  sequences: number;
  checks: number;
  counterexamples: number;
}

const makeReading = (slot: number, kwh: number, key: string) => makeHourlyReading("H", slot, kwh, key);

/** Run `count` sequences starting at `seedStart`; every step must keep Σ = 0. */
export function runSequences(seedStart: number, count: number): HarnessResult {
  let checks = 0;
  let counterexamples = 0;

  for (let s = 0; s < count; s++) {
    const rng = mulberry32(seedStart + s);
    let state: BillingState = createBillingState("H");
    let now = START_NOW;
    let lastKey = "";
    const steps = 8 + Math.floor(rng() * 16);

    for (let i = 0; i < steps; i++) {
      try {
        const r = rng();
        if (r < 0.5) {
          const slot = Math.floor(rng() * 300);
          const key = rng() < 0.25 && lastKey ? lastKey : `k-${s}-${i}-${Math.floor(rng() * 1000)}`;
          state = ingest(state, makeReading(slot, 1 + Math.floor(rng() * 40) / 2, key), now).state;
          lastKey = key;
        } else if (r < 0.7) {
          state = issueInvoice(state, CYCLE, now).state;
        } else if (r < 0.85) {
          state = reconcile(state, CYCLE, now).state;
        } else {
          state = declareFlag(state, CYCLE, FLAGS[Math.floor(rng() * FLAGS.length)]!, now);
        }
        now += MS_PER_HOUR;
        if (totalBalance(state.entries) !== 0) counterexamples++;
      } catch {
        // A thrown balance guard is itself a counterexample.
        counterexamples++;
      }
      checks++;
    }
  }

  return { sequences: count, checks, counterexamples };
}
