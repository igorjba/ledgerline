import { NextResponse } from "next/server";
import { hasQStash, verifySignature } from "@/lib/outbox/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The outbox consumer. QStash delivers each drained event here with a signed
 * request; the handler verifies the signature (when QStash is configured) and
 * acknowledges. Delivery is at-least-once, so a real consumer must be idempotent
 * — here the work is a no-op ack, which is trivially so.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();

  if (hasQStash()) {
    const signature = req.headers.get("upstash-signature");
    if (!signature || !(await verifySignature(signature, body).catch(() => false))) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let event: { id?: string; type?: string };
  try {
    event = JSON.parse(body) as { id?: string; type?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, received: event.id ?? null, type: event.type ?? null });
}
