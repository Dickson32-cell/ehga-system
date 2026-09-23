import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query, tx } from "@/lib/db";
import { waLink, waBookingText } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["Pending", "Confirmed", "Boarded"];

/**
 * GET /api/portal/bookings - the signed-in customer's bookings ONLY.
 * Every query filters by customer_id = session.id: no customer can ever see
 * another customer's data.
 */
export const GET = apiHandler(async () => {
  const session = await requireCustomer();
  const { rows } = await query(
    `SELECT b.id, b.booking_code, b.travel_date, b.direction, b.departure_time,
            b.seats, b.fare_per_seat, b.passenger_revenue, b.amount_paid, b.balance,
            b.payment_method, b.status, b.pickup_point, b.dropoff_point,
            v.model AS vehicle_model, v.color AS vehicle_color, v.registration AS vehicle_registration
       FROM booking b
       LEFT JOIN vehicle v ON v.vehicle_code = b.vehicle_id
      WHERE b.customer_id = $1 AND b.deleted = FALSE
      ORDER BY b.travel_date DESC, b.id DESC LIMIT 100`,
    [session.id]
  );
  return Response.json({ data: rows });
});

/** POST { direction, travel_date, departure_time, seats, pickup_point, dropoff_point, notes } */
export const POST = apiHandler(async (req) => {
  const session = await requireCustomer();
  const body = await req.json().catch(() => ({}));

  const direction = String(body.direction || "").trim();
  const travelDate = String(body.travel_date || "");
  const seats = parseInt(body.seats, 10);
  const name = session.full_name;

  if (!direction) return Response.json({ error: "Choose your route" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) {
    return Response.json({ error: "Choose a valid travel date" }, { status: 400 });
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > 6) {
    return Response.json({ error: "Seats must be between 1 and 6" }, { status: 400 });
  }

  // Fare from setup (standard_fare), never client-supplied.
  const { rows: kv } = await query("SELECT value FROM setup_kv WHERE key = 'standard_fare'");
  const fare = Number(kv[0]?.value || 90);

  const result = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO booking(travel_date, direction, departure_time, customer_name, phone, seats,
                           fare_per_seat, payment_method, status, pickup_point, dropoff_point, notes, source, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'MoMo','Pending',$8,$9,$10,'portal',$11)
       RETURNING *`,
      [
        travelDate,
        direction,
        String(body.departure_time || "").trim() || null,
        name,
        session.phone,
        seats,
        fare,
        String(body.pickup_point || "").trim() || null,
        String(body.dropoff_point || "").trim() || null,
        String(body.notes || "").trim() || null,
        session.id,
      ]
    );
    return rows[0];
  });

  const { rows: wa } = await query("SELECT value FROM setup_kv WHERE key = 'whatsapp_line'");
  return Response.json(
    {
      data: result,
      whatsapp_url: waLink(wa[0]?.value || "", waBookingText(result)),
      message: "Booking received. Our dispatcher will confirm shortly.",
    },
    { status: 201 }
  );
});