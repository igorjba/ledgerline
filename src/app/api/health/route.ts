import { NextResponse } from "next/server";
import {
  createBillingState,
  fromLocalParts,
  ingest,
  isBalanced,
  issueInvoice,
} from "@/lib/domain";
import { backendInfo, getRepository } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness that actually exercises the core. It runs one reading through the pure
 * billing engine and checks the ledger balances and an invoice was cut — so a
 * green check means the billing logic works, not merely that the server answered.
 * It also pings the live repository. Either failing returns 503.
 */
export async function GET(): Promise<NextResponse> {
  const checks: Record<string, boolean> = {};

  try {
    const now = fromLocalParts(2026, 8, 1);
    let state = createBillingState("HEALTHCHECK");
    state = ingest(state, {
      idempotencyKey: "health-1",
      meterId: "HEALTHCHECK",
      periodStart: fromLocalParts(2026, 7, 15, 19),
      periodEnd: fromLocalParts(2026, 7, 15, 20),
      kwh: 10,
      source: "ami",
    }, now).state;
    const issued = issueInvoice(state, { year: 2026, month: 7 }, now);
    checks.core = issued.invoice !== null && issued.invoice.computed.totalCents > 0;
    checks.ledger = isBalanced(issued.state.entries);
  } catch {
    checks.core = false;
  }

  try {
    await getRepository().healthCheck();
    checks.repository = true;
  } catch {
    checks.repository = false;
  }

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks, backend: backendInfo() },
    { status: ok ? 200 : 503 },
  );
}
