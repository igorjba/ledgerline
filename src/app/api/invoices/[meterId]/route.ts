import { NextResponse } from "next/server";
import {
  computeInvoice,
  cycleRange,
  DEFAULT_WHITE_TARIFF,
  FLAG_COLORS,
  type BillingCycle,
  type FlagColor,
  type Reading,
} from "@/lib/domain";
import { backendInfo, getRepository } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compute a meter's invoice for a cycle, as known at `asOf` (default now). This is
 * the bitemporal "as-of" query over HTTP: the same request with an earlier `asOf`
 * reproduces the invoice as it stood before any later correction.
 *
 *   GET /api/invoices/MTR-1?cycle=2026-07&asOf=2026-08-01T00:00:00Z&flag=yellow
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ meterId: string }> },
): Promise<NextResponse> {
  const { meterId } = await params;
  const url = new URL(req.url);

  const cycle = parseCycle(url.searchParams.get("cycle"));
  if (!cycle) {
    return NextResponse.json({ error: "cycle must look like 2026-07" }, { status: 400 });
  }

  const asOfParam = url.searchParams.get("asOf");
  const knownAsOf = asOfParam ? Date.parse(asOfParam) : Date.now();
  if (Number.isNaN(knownAsOf)) {
    return NextResponse.json({ error: "asOf must be an ISO-8601 instant" }, { status: 400 });
  }

  const flagParam = url.searchParams.get("flag");
  const flagColor: FlagColor = FLAG_COLORS.includes(flagParam as FlagColor)
    ? (flagParam as FlagColor)
    : "green";

  const rows = await getRepository().knownReadings(meterId, cycleRange(cycle), knownAsOf);
  const readings: Reading[] = rows.map((r) => ({
    idempotencyKey: r.idempotencyKey,
    meterId: r.meterId,
    periodStart: r.validStart,
    periodEnd: r.validEnd,
    kwh: r.kwh,
    source: r.source,
  }));

  const invoice = computeInvoice({
    meterId,
    cycle,
    readings,
    tariff: DEFAULT_WHITE_TARIFF,
    flagColor,
  });

  return NextResponse.json({
    invoice,
    knownAsOf: new Date(knownAsOf).toISOString(),
    readingCount: readings.length,
    backend: backendInfo(),
  });
}

function parseCycle(value: string | null): BillingCycle | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}
