"use client";

import { Controls } from "./Controls";
import { InvariantHarness } from "./InvariantHarness";
import { InvoiceCard } from "./InvoiceCard";
import { LedgerCard } from "./LedgerCard";
import { OutboxCard } from "./OutboxCard";
import { ReadingsTimeline } from "./ReadingsTimeline";
import { TimeMachine } from "./TimeMachine";
import { TopBar } from "./TopBar";

export function Console() {
  return (
    <div
      data-testid="console"
      className="overflow-hidden rounded-panel border border-edge bg-abyss/60 ledger-grid shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      <TopBar />
      <div className="grid gap-3 p-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3">
          <Controls />
          <TimeMachine />
          <OutboxCard />
        </div>
        <div className="flex flex-col gap-3">
          <InvoiceCard />
          <InvariantHarness />
        </div>
        <div className="flex flex-col gap-3">
          <LedgerCard />
          <ReadingsTimeline />
        </div>
      </div>
    </div>
  );
}
