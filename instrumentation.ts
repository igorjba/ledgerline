/**
 * OpenTelemetry registration. Most of the work happens in the pure billing core,
 * but the server surface — health check, ingestion, the outbox relay — is worth
 * tracing. `@vercel/otel` wires spans straight into Vercel's OTel pipeline with
 * zero config when deployed, and is a no-op collector locally.
 */

import { registerOTel } from "@vercel/otel";

export function register(): void {
  registerOTel({ serviceName: "ledgerline" });
}
