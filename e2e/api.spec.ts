import { expect, test } from "@playwright/test";

test.describe("api", () => {
  test("health check runs the billing core and reports ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.core).toBe(true);
    expect(body.checks.ledger).toBe(true);
  });

  test("accepts a well-formed reading", async ({ request }) => {
    // Idempotency and correction are proven where there is shared state — the unit
    // tests (one MemoryRepo instance) and the Postgres integration suite. Over HTTP
    // on the ephemeral in-memory backend, this asserts only the ingestion contract.
    const reading = {
      idempotencyKey: `e2e-${Date.now()}`,
      meterId: "MTR-E2E",
      periodStart: Date.UTC(2026, 6, 10, 22),
      periodEnd: Date.UTC(2026, 6, 10, 23),
      kwh: 7.5,
      source: "ami",
    };
    const res = await request.post("/api/readings", { data: reading });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(["accepted", "corrected", "duplicate"]).toContain(body.outcome);
    expect(body.backend.repo).toBeDefined();
  });

  test("rejects a malformed reading", async ({ request }) => {
    const res = await request.post("/api/readings", { data: { meterId: "x" } });
    expect(res.status()).toBe(400);
  });

  test("computes an as-of invoice for a cycle", async ({ request }) => {
    const res = await request.get("/api/invoices/MTR-E2E?cycle=2026-07");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.invoice.cycle).toEqual({ year: 2026, month: 7 });
  });

  test("the outbox drain is not open without authorization", async ({ request }) => {
    // Fail-closed: with no CRON_SECRET set it is disabled (503); with one set an
    // unauthenticated call is rejected (401). Never a 200 to an anonymous caller.
    const res = await request.post("/api/outbox/drain");
    expect([401, 503]).toContain(res.status());
  });
});
