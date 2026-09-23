import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { autoQuote } from "@/lib/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hire-quote { direction, vehicle_code? } -> auto-quote preview for
 * staff (dispatcher/ops) and the portal. Distance + vehicle rate from Setup.
 */
export const POST = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER");
  const body = await req.json().catch(() => ({}));
  const direction = String(body.direction || "").trim();
  if (!direction) return Response.json({ error: "direction is required" }, { status: 400 });
  const vehicleCode = String(body.vehicle_code || "").trim() || null;
  const quote = await autoQuote({ direction, vehicleCode });
  return Response.json({ data: quote });
});