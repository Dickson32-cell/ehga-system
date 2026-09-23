import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { autoQuote } from "@/lib/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal/hire-quote { direction?, pickup, destination, vehicle_code? }
 * Customer-facing instant quote (fuel-aware). Mirrors /api/hire-quote but is
 * scoped to signed-in customers; the returned estimate is a preview only —
 * the MD confirms the final price.
 */
export const POST = apiHandler(async (req) => {
  await requireCustomer();
  const body = await req.json().catch(() => ({}));
  const pickup = String(body.pickup || "").trim();
  const destination = String(body.destination || "").trim();
  if (!pickup || !destination) {
    return Response.json({ error: "Enter pickup and destination first" }, { status: 400 });
  }
  const direction =
    String(body.direction || "").trim() || `Private: ${pickup} to ${destination}`;
  const vehicleCode = String(body.vehicle_code || "").trim() || null;
  const quote = await autoQuote({ direction, vehicleCode, pickup, destination });
  return Response.json({ data: quote });
});