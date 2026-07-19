import { create } from "zustand";
import {
  createBillingState,
  declareFlag,
  drainOutbox,
  flagLabel,
  fromLocalParts,
  ingest,
  issueInvoice,
  MS_PER_HOUR,
  outcomeLabel,
  reconcile,
  type BillingState,
  type FlagColor,
  type IngestOutcome,
} from "@/lib/domain";
import { DEMO_CYCLE, DEMO_METER, makeHourlyReading } from "@/lib/demo/scenario";

/*
 * Client-side console state. The whole billing engine is pure and runs right
 * here in the browser — this store only sequences user actions into engine calls
 * and advances a simulated clock so each mutation gets its own transaction time
 * (what makes the bitemporal time-machine legible). Nothing here is app logic; it
 * is a driver for the same core the server and the tests use.
 */

export const METER = DEMO_METER;
export const CYCLE = DEMO_CYCLE;

const BASE_NOW = fromLocalParts(2026, 8, 1, 9, 0);
const STEP = MS_PER_HOUR;

/** Deterministic, varied consumption so the demo is reproducible run to run. */
function kwhFor(seq: number): number {
  return 3 + ((seq * 13) % 47) * 0.5;
}

function makeReading(slot: number, kwh: number, key: string): ReturnType<typeof makeHourlyReading> {
  return makeHourlyReading(METER, slot, kwh, key);
}

interface Seed {
  state: BillingState;
  clock: number;
  seq: number;
  slots: number[];
  firstSlot: number | null;
  lastKey: string | null;
  nextForward: number;
  nextBack: number;
}

function seed(): Seed {
  let state = createBillingState(METER);
  let clock = BASE_NOW;
  let seq = 0;
  const slots = [120, 138, 156, 170, 200];
  let lastKey = "";
  for (const slot of slots) {
    const key = `k-${seq}`;
    state = ingest(state, makeReading(slot, kwhFor(seq), key), clock).state;
    lastKey = key;
    clock += STEP;
    seq += 1;
  }
  state = declareFlag(state, CYCLE, "yellow", clock);
  clock += STEP;
  state = issueInvoice(state, CYCLE, clock).state;
  clock += STEP;
  return { state, clock, seq, slots, firstSlot: slots[0] ?? null, lastKey, nextForward: 214, nextBack: 108 };
}

interface BillingStore extends Seed {
  knownAsOf: number | null;
  lastOutcome: IngestOutcome | null;
  lastEvent: string | null;
  addReading: () => void;
  injectOutOfOrder: () => void;
  injectDuplicate: () => void;
  injectCorrection: () => void;
  setFlag: (color: FlagColor) => void;
  issue: () => void;
  reconcileCycle: () => void;
  drain: () => void;
  setKnownAsOf: (t: number | null) => void;
  reset: () => void;
}

export const useBillingStore = create<BillingStore>((set) => ({
  ...seed(),
  knownAsOf: null,
  lastOutcome: null,
  lastEvent: "cenário iniciado · 5 leituras, bandeira amarela, fatura emitida",

  addReading: () =>
    set((s) => {
      const key = `k-${s.seq}`;
      const res = ingest(s.state, makeReading(s.nextForward, kwhFor(s.seq), key), s.clock);
      return {
        state: res.state,
        clock: s.clock + STEP,
        seq: s.seq + 1,
        lastKey: key,
        slots: [...s.slots, s.nextForward],
        nextForward: s.nextForward + 18,
        knownAsOf: null,
        lastOutcome: res.outcome,
        lastEvent: `leitura ${key} registrada`,
      };
    }),

  injectOutOfOrder: () =>
    set((s) => {
      const key = `k-${s.seq}`;
      const res = ingest(s.state, makeReading(s.nextBack, kwhFor(s.seq), key), s.clock);
      return {
        state: res.state,
        clock: s.clock + STEP,
        seq: s.seq + 1,
        lastKey: key,
        slots: [...s.slots, s.nextBack],
        nextBack: s.nextBack - 13,
        knownAsOf: null,
        lastOutcome: res.outcome,
        lastEvent: `leitura ${key} fora de ordem (período anterior) registrada`,
      };
    }),

  injectDuplicate: () =>
    set((s) => {
      if (!s.lastKey) return {};
      const res = ingest(s.state, makeReading(0, 0, s.lastKey), s.clock);
      return {
        state: res.state,
        clock: s.clock + STEP,
        lastOutcome: res.outcome,
        lastEvent: `reenvio de ${s.lastKey} → ${outcomeLabel(res.outcome)}`,
      };
    }),

  injectCorrection: () =>
    set((s) => {
      if (s.firstSlot === null) return {};
      const key = `k-${s.seq}-fix`;
      const res = ingest(s.state, makeReading(s.firstSlot, kwhFor(s.seq) + 20, key), s.clock);
      return {
        state: res.state,
        clock: s.clock + STEP,
        seq: s.seq + 1,
        lastKey: key,
        knownAsOf: null,
        lastOutcome: res.outcome,
        lastEvent: `correção na leitura mais antiga → ${outcomeLabel(res.outcome)}`,
      };
    }),

  setFlag: (color) =>
    set((s) => ({
      state: declareFlag(s.state, CYCLE, color, s.clock),
      clock: s.clock + STEP,
      knownAsOf: null,
      lastEvent: `bandeira ${flagLabel(color)} declarada para ${CYCLE.year}-${String(CYCLE.month).padStart(2, "0")}`,
    })),

  issue: () =>
    set((s) => {
      const result = issueInvoice(s.state, CYCLE, s.clock);
      return {
        state: result.state,
        clock: s.clock + STEP,
        knownAsOf: null,
        lastEvent: result.invoice ? `fatura ${result.invoice.id} emitida` : "fatura já emitida para este ciclo",
      };
    }),

  reconcileCycle: () =>
    set((s) => {
      const result = reconcile(s.state, CYCLE, s.clock);
      return {
        state: result.state,
        clock: s.clock + STEP,
        knownAsOf: null,
        lastEvent: result.note
          ? `nota de ajuste ${result.note.id} emitida (Δ ${result.note.delta.totalCents} centavos)`
          : "nada a reconciliar — a fatura confere",
      };
    }),

  drain: () =>
    set((s) => {
      const result = drainOutbox(s.state);
      return {
        state: result.state,
        lastEvent:
          result.drained.length > 0 ? `outbox drenado · ${result.drained.length} evento(s)` : "outbox vazio",
      };
    }),

  setKnownAsOf: (t) => set({ knownAsOf: t }),

  reset: () =>
    set(() => ({
      ...seed(),
      knownAsOf: null,
      lastOutcome: null,
      lastEvent: "cenário reiniciado",
    })),
}));

export { BASE_NOW };
