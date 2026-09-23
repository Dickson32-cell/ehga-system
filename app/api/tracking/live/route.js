import { apiHandler, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tracking/live - one-shot snapshot of all vehicles' latest positions
 * for the staff Fleet Tracker map (MD sees all; other staff see the same feed
 * for operational awareness, per diagram "Live map of every vehicle, staff side").
 */
export const GET = apiHandler(async () => {
  await requireSession();

  const { rows } = await query(
    `SELECT v.vehicle_code, v.type, v.model, v.color, v.registration, v.status,
            v.assigned_driver, v.assigned_driver AS driver,
            p.lat, p.lng, p.speed_kph, p.heading, p.recorded_at,
            p.job_type, p.job_code,
            (v.insurance_expiry IS NOT NULL AND v.insurance_expiry < CURRENT_DATE)
              OR (v.roadworthy_expiry IS NOT NULL AND v.roadworthy_expiry < CURRENT_DATE) AS docs_expired,
            EXTRACT(EPOCH FROM (now() - p.recorded_at))/60 AS minutes_since_ping
       FROM vehicle v
       LEFT JOIN LATERAL (
            SELECT lat, lng, speed_kph, heading, recorded_at, job_type, job_code
              FROM vehicle_position WHERE vehicle_code = v.vehicle_code
             ORDER BY recorded_at DESC LIMIT 1
       ) p ON TRUE
      WHERE v.deleted = FALSE
      ORDER BY v.vehicle_code`
  );

  const data = rows.map((r) => ({
    ...r,
    stale: r.recorded_at ? Number(r.minutes_since_ping) > 30 : true, // idle/no-movement watch
    docs_expired: !!r.docs_expired,
  }));
  return Response.json({ data });
});