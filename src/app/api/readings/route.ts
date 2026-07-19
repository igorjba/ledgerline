import { after, NextResponse } from "next/server";
import type { Reading, ReadingSource } from "@/lib/domain";
import { backendInfo, getPublisher, getRepository, outboxCallbackUrl } from "@/lib/config";
import { relayOutbox } from "@/lib/outbox/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES: ReadingSource[] = ["ami", "manual", "estimate"];

/**
 * Ingest a reading. Idempotent by `idempotencyKey`; accepts out-of-order and
 * duplicate deliveries. The outbox row is written in the same step, and the relay
 * is kicked best-effort with `after()` once the response is on its way — the
 * daily cron is the backstop if this instance dies first.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const reading = parseReading(body);
  if (!reading) {
    return NextResponse.json(
      { error: "expected { idempotencyKey, meterId, periodStart, periodEnd, kwh, source }" },
      { status: 400 },
    );
  }

  const repo = getRepository();
  const receipt = await repo.ingestReading(reading, Date.now());

  const callbackUrl = outboxCallbackUrl(req);
  after(async () => {
    await relayOutbox(repo, getPublisher(callbackUrl), Date.now());
  });

  return NextResponse.json({ outcome: receipt.outcome, id: receipt.id, backend: backendInfo() });
}

function parseReading(body: unknown): Reading | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.idempotencyKey !== "string" ||
    b.idempotencyKey === "" ||
    typeof b.meterId !== "string" ||
    b.meterId === "" ||
    typeof b.periodStart !== "number" ||
    typeof b.periodEnd !== "number" ||
    typeof b.kwh !== "number" ||
    // Reject Infinity/NaN explicitly: they are typeof "number" and slip past a
    // bare `end <= start` check (any comparison with NaN is false, Infinity is a
    // valid range upper bound), which would then poison every cycle they overlap.
    !Number.isFinite(b.periodStart) ||
    !Number.isFinite(b.periodEnd) ||
    !Number.isFinite(b.kwh) ||
    b.periodEnd <= b.periodStart ||
    b.kwh < 0
  ) {
    return null;
  }
  const source = SOURCES.includes(b.source as ReadingSource) ? (b.source as ReadingSource) : "ami";
  return {
    idempotencyKey: b.idempotencyKey,
    meterId: b.meterId,
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
    kwh: b.kwh,
    source,
  };
}
