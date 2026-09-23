import { apiHandler, requireRole } from "@/lib/auth";
import { autoQuote } from "@/lib/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hire-quote { direction, vehicle_code?, pickup?, destination? }
 * -> auto-quote preview for staff and the portal. Distance resolution:
 * exact direction key in Setup `route_km`, else pickup+destination matched
 * against route_km entries, else a 25 km estimate. Fuel-aware: km ÷ km/L
 * (per-car override) × GHS/L from Setup, added to base + distance rate.
 */
export const POST = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER");
  const body = await req.json().catch(() => ({}));
  const direction = String(body.direction || "").trim();
  if (!direction) return Response.json({ error: "direction is required" }, { status: 400 });
  const vehicleCode = String(body.vehicle_code || "").trim() || null;
  const pickup = String(body.pickup || "").trim() || null;
  const destination = String(body.destination || "").trim() || null;
  const quote = await autoQuote({ direction, vehicleCode, pickup, destination });
  return Response.json({ data: quote });
});