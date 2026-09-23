import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET - tracking summary for the customer's active trips (live map client polls this). */
export const GET = apiHandler(async () => {
  const session = await requireCustomer();

  const [bookings, parcels, hires] = await Promise.all([
    query(
      `SELECT b.booking_code AS code, 'booking' AS kind, b.direction, b.travel_date AS date,
              b.departure_time, b.status,
              v.vehicle_code, v.model, v.color, v.registration,
              vp.lat, vp.lng, vp.speed_kph, vp.recorded_at
         FROM booking b
         LEFT JOIN vehicle v ON v.vehicle_code = b.vehicle_id
         LEFT JOIN LATERAL (
              SELECT lat, lng, speed_kph, recorded_at FROM vehicle_position
               WHERE vehicle_code = v.vehicle_code ORDER BY recorded_at DESC LIMIT 1
         ) vp ON TRUE
        WHERE b.customer_id = $1 AND b.deleted = FALSE
          AND b.status IN ('Confirmed','Boarded')
          AND b.travel_date >= CURRENT_DATE - INTERVAL '1 day'
        ORDER BY b.travel_date DESC`,
      [session.id]
    ),
    query(
      `SELECT p.parcel_code AS code, 'parcel' AS kind, p.status,
              p.pickup_address, p.delivery_address,
              v.vehicle_code, v.model, v.color, v.registration,
              vp.lat, vp.lng, vp.speed_kph, vp.recorded_at
         FROM parcel p
         LEFT JOIN vehicle v ON v.vehicle_code = p.vehicle_id
         LEFT JOIN LATERAL (
              SELECT lat, lng, speed_kph, recorded_at FROM vehicle_position
               WHERE vehicle_code = v.vehicle_code ORDER BY recorded_at DESC LIMIT 1
         ) vp ON TRUE
        WHERE p.customer_id = $1 AND p.deleted = FALSE
          AND p.status IN ('Collected','At hub','In transit','Out for delivery')`,
      [session.id]
    ),
    query(
      `SELECT h.hire_code AS code, 'private_hire' AS kind, h.status, h.service_date AS date,
              h.pickup AS pickup_address, h.destination AS delivery_address,
              v.vehicle_code, v.model, v.color, v.registration,
              vp.lat, vp.lng, vp.speed_kph, vp.recorded_at
         FROM private_hire h
         LEFT JOIN vehicle v ON v.vehicle_code = h.vehicle_id
         LEFT JOIN LATERAL (
              SELECT lat, lng, speed_kph, recorded_at FROM vehicle_position
               WHERE vehicle_code = v.vehicle_code ORDER BY recorded_at DESC LIMIT 1
         ) vp ON TRUE
        WHERE h.customer_id = $1 AND h.deleted = FALSE
          AND h.status IN ('Confirmed','In progress')
          AND h.service_date >= CURRENT_DATE - INTERVAL '1 day'`,
      [session.id]
    ),
  ]);

  const active = [...bookings.rows, ...parcels.rows, ...hires.rows];
  return Response.json({ data: active });
});