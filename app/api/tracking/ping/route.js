import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tracking/ping - drivers & riders post their phone GPS while on duty.
 * Body: { lat, lng, speed_kph?, heading?, accuracy_m? }
 * The vehicle/job context is resolved from the driver's assigned dispatch/trip
 * for today; no client-supplied vehicle code is trusted.
 */
export const POST = apiHandler(async (req) => {
  const session = await requireRole("DRIVER", "RIDER", "MANAGING_DIRECTOR", "OPERATIONS_MANAGER");
  const body = await req.json().catch(() => ({}));

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  // Resolve this user's active vehicle for today: assigned_driver on vehicle,
  // or today's dispatch driver name matching the session full_name/username.
  const name = String(session.full_name || session.username || "").trim();
  const { rows: v } = await query(
    `SELECT v.vehicle_code, v.assigned_driver,
            d.dispatch_code AS job_code, 'dispatch' AS job_type
       FROM vehicle v
       LEFT JOIN LATERAL (
            SELECT id, dispatch_code FROM dispatch
             WHERE vehicle_id = v.vehicle_code AND deleted = FALSE
               AND date = CURRENT_DATE AND decision = 'Go'
             ORDER BY id DESC LIMIT 1
       ) d ON TRUE
      WHERE v.deleted = FALSE AND (v.assigned_driver = $1 OR d.id IS NOT NULL)
      ORDER BY (v.assigned_driver = $1) DESC NULLS LAST, d.id DESC NULLS LAST
      LIMIT 1`,
    [name]
  );

  let vehicleCode = v[0]?.vehicle_code || null;
  let jobCode = v[0]?.job_code || null;
  let jobType = v[0]?.job_type || null;

  if (!vehicleCode && body.vehicle_code) {
    // Fallback: explicit vehicle_code, but only for MD/Ops who may track any vehicle.
    if (session.role === "MANAGING_DIRECTOR" || session.role === "OPERATIONS_MANAGER") {
      vehicleCode = String(body.vehicle_code);
      jobType = "manual";
    }
  }
  if (!vehicleCode) {
    return Response.json({ ok: false, reason: "No vehicle assigned to you today" }, { status: 200 });
  }

  await query(
    `INSERT INTO vehicle_position(vehicle_code, lat, lng, speed_kph, heading, accuracy_m, job_type, job_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      vehicleCode,
      lat,
      lng,
      isFinite(Number(body.speed_kph)) ? Number(body.speed_kph) : null,
      isFinite(Number(body.heading)) ? Number(body.heading) : null,
      isFinite(Number(body.accuracy_m)) ? Number(body.accuracy_m) : null,
      jobType,
      jobCode,
    ]
  );

  return Response.json({ ok: true, vehicle: vehicleCode });
});