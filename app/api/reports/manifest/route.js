import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/manifest?date=YYYY-MM-DD&direction=... - printable daily
 * manifest (passengers) and waybills (parcels). Returns JSON the client
 * renders into a print-optimised page (window.print()).
 */
export const GET = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER", "ACCOUNTANT");
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const direction = url.searchParams.get("direction") || null;

  const params = [date];
  let vwhere = "";
  if (direction) {
    params.push(direction);
    vwhere = " AND b.direction = $" + params.length;
  }

  const bookings = await query(
    `SELECT b.booking_code, b.travel_date, b.direction, b.departure_time, b.customer_name,
            b.phone, b.seats, b.fare_per_seat, b.passenger_revenue, b.amount_paid, b.balance,
            b.payment_method, b.status, b.pickup_point, b.dropoff_point,
            v.vehicle_code, v.model, v.color, v.registration, v.vehicle_code AS vehicle_label
       FROM booking b LEFT JOIN vehicle v ON v.vehicle_code = b.vehicle_id
      WHERE b.travel_date = $1 AND b.deleted = FALSE AND b.status NOT IN ('Cancelled','No show')${vwhere}
      ORDER BY v.vehicle_code, b.departure_time, b.booking_code`,
    params
  );

  const parcels = await query(
    `SELECT p.parcel_code, p.booking_date, p.sender, p.sender_phone, p.recipient, p.recipient_phone,
            p.pickup_address, p.delivery_address, p.description, p.size, p.total_charge,
            p.amount_paid, p.balance, p.status,
            v.vehicle_code, v.model, v.color, v.registration
       FROM parcel p LEFT JOIN vehicle v ON v.vehicle_code = p.vehicle_id
      WHERE p.booking_date = $1 AND p.deleted = FALSE AND p.status NOT IN ('Cancelled','Returned')${vwhere}
      ORDER BY p.parcel_code`,
    params
  );

  const dispatch = await query(
    `SELECT d.*, v.model, v.color, v.registration FROM dispatch d
      LEFT JOIN vehicle v ON v.vehicle_code = d.vehicle_id
      WHERE d.date = $1 AND d.deleted = FALSE
      ORDER BY d.departure_time`,
    params
  );

  return Response.json({
    date,
    bookings: bookings.rows,
    parcels: parcels.rows,
    dispatch: dispatch.rows,
  });
});