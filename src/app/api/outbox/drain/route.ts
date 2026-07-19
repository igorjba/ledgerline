import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { backendInfo, getPublisher, getRepository, outboxCallbackUrl } from "@/lib/config";
import { relayOutbox } from "@/lib/outbox/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drain the transactional outbox. Called two ways: by the daily Vercel cron (the
 * backstop — Hobby caps cron at once per day) and manually for operations. It
 * mutates state (publishes events), so it is fail-closed: without CRON_SECRET set
 * the endpoint is disabled, and the token is compared in constant time. The
 * best-effort relay after each ingestion runs in-process and does not go through
 * this route.
 */
async function drain(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "drain disabled: CRON_SECRET is not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = getRepository();
  const result = await relayOutbox(repo, getPublisher(outboxCallbackUrl(req)), Date.now());

  return NextResponse.json({ drained: result.drained, backend: backendInfo() });
}

/** Compare via fixed-length hashes so neither the timing nor the length leaks. */
function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const GET = drain;
export const POST = drain;
