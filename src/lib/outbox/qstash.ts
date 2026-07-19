/**
 * QStash binding for the outbox. QStash is Upstash's HTTP message queue: publish
 * an event and it delivers it to a URL with retries and a signature, which is
 * exactly the durability a serverless relay needs — the function that drains the
 * outbox can die and QStash still guarantees eventual delivery.
 *
 * Everything here is optional. With no token the publisher is a no-op that still
 * lets the relay mark rows drained locally, so the demo works with zero setup.
 */

import { Client, Receiver } from "@upstash/qstash";
import type { OutboxRow } from "../ports/repository";

export function hasQStash(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}

export type Publisher = (event: OutboxRow) => Promise<void>;

/** A publisher that hands each event to QStash for delivery to `callbackUrl`. */
export function qstashPublisher(callbackUrl: string): Publisher {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  return async (event) => {
    await client.publishJSON({
      url: callbackUrl,
      body: { id: event.id, type: event.type, payload: event.payload },
      retries: 3,
      headers: { "Upstash-Deduplication-Id": event.id },
    });
  };
}

/** A publisher that does nothing — used when QStash is not configured. */
export const noopPublisher: Publisher = async () => {};

/** Verify an inbound QStash webhook signature. Throws if it does not check out. */
export async function verifySignature(signature: string, body: string): Promise<boolean> {
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? "",
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "",
  });
  return receiver.verify({ signature, body });
}
