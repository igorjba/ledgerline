/**
 * Wiring. One place decides which adapter is live, based purely on the
 * environment: a DATABASE_URL switches storage onto Postgres, a QSTASH_TOKEN
 * switches the relay onto QStash. With neither set, the same code runs on an
 * in-memory repo and a no-op publisher — the zero-config demo path.
 *
 * The in-memory repo is a per-process singleton so it survives across requests in
 * one warm serverless instance. It is still ephemeral and not shared between
 * instances; durability is what the Postgres path is for.
 */

import { MemoryRepo } from "./adapters/memory";
import { hasDatabase, PostgresRepo } from "./adapters/postgres";
import { hasQStash, noopPublisher, qstashPublisher, type Publisher } from "./outbox/qstash";
import type { Repository } from "./ports/repository";

// Anchored on globalThis so it survives dev HMR and persists across requests in
// one warm serverless instance — it is still per-instance and ephemeral.
const globalStore = globalThis as typeof globalThis & { __ledgerlineMemoryRepo?: MemoryRepo };

export function getRepository(): Repository {
  if (hasDatabase()) return new PostgresRepo();
  globalStore.__ledgerlineMemoryRepo ??= new MemoryRepo();
  return globalStore.__ledgerlineMemoryRepo;
}

export function getPublisher(callbackUrl: string): Publisher {
  return hasQStash() ? qstashPublisher(callbackUrl) : noopPublisher;
}

/**
 * The URL QStash should call back into. Prefers an explicit env value or Vercel's
 * own VERCEL_URL over the request's Host header, so a spoofed Host cannot steer
 * where published events are delivered.
 */
export function outboxCallbackUrl(req: Request): string {
  const explicit = process.env.QSTASH_TARGET_URL;
  if (explicit) return explicit;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}/api/qstash`;
  return new URL("/api/qstash", req.url).toString();
}

export interface BackendInfo {
  readonly repo: "postgres" | "memory";
  readonly queue: "qstash" | "inline";
  readonly version: string;
}

export function backendInfo(): BackendInfo {
  return {
    repo: hasDatabase() ? "postgres" : "memory",
    queue: hasQStash() ? "qstash" : "inline",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  };
}
