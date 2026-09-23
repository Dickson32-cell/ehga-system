import { apiHandler, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tracking/history?vehicle=CAM-01&hours=8 - breadcrumb trail for one vehicle. */
export const GET = apiHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const vehicle = url.searchParams.get("vehicle");
  const hours = Math.min(Math.max(parseInt(url.searchParams.get("hours") || "8", 10) || 8, 1), 72);

  if (!vehicle) return Response.json({ error: "vehicle is required" }, { status: 400 });

  const { rows } = await query(
    `SELECT lat, lng, speed_kph, heading, job_type, job_code, recorded_at
       FROM vehicle_position
      WHERE vehicle_code = $1 AND recorded_at >= now() - ($2 || ' hours')::interval
      ORDER BY recorded_at ASC LIMIT 2000`,
    [vehicle, String(hours)]
  );
  return Response.json({ data: rows });
});