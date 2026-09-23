import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/vehicles?code=CAM-01 - public-safe vehicle details for the
 * portal ("Sees the car: model · color · registration"). Only non-sensitive
 * fields are returned; odometers/defects/insurance stay staff-only.
 */
export const GET = apiHandler(async (req) => {
  await requireCustomer();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (code) {
    const { rows } = await query(
      "SELECT vehicle_code, type, model, color, registration FROM vehicle WHERE vehicle_code = $1 AND deleted = FALSE",
      [code]
    );
    if (!rows.length) return Response.json({ error: "Vehicle not found" }, { status: 404 });
    return Response.json({ data: rows[0] });
  }

  const { rows } = await query(
    "SELECT vehicle_code, type, model, color, registration FROM vehicle WHERE deleted = FALSE AND status = 'Available' ORDER BY vehicle_code"
  );
  return Response.json({ data: rows });
});