import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query, tx } from "@/lib/db";
import { autoQuote } from "@/lib/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET - the customer's private hires only, with car details + quote status. */
export const GET = apiHandler(async () => {
  const session = await requireCustomer();
  const { rows } = await query(
    `SELECT h.id, h.hire_code, h.service_date, h.service_type, h.pickup, h.destination,
            h.start_time, h.end_time, h.quoted_amount, h.amount_paid, h.balance,
            h.status, h.quote_status, h.notes,
            v.model AS vehicle_model, v.color AS vehicle_color, v.registration AS vehicle_registration
       FROM private_hire h
       LEFT JOIN vehicle v ON v.vehicle_code = h.vehicle_id
      WHERE h.customer_id = $1 AND h.deleted = FALSE
      ORDER BY h.service_date DESC, h.id DESC LIMIT 100`,
    [session.id]
  );
  return Response.json({ data: rows });
});

/**
 * POST { service_date, service_type, pickup, destination, start_time, end_time, direction? }
 * Auto-quote (distance + vehicle rate); the request lands as status "Inquiry"
 * with quote_status "Auto" for MD/dispatcher review and confirmation.
 */
export const POST = apiHandler(async (req) => {
  const session = await requireCustomer();
  const body = await req.json().catch(() => ({}));

  const serviceDate = String(body.service_date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return Response.json({ error: "Choose a valid date for the hire" }, { status: 400 });
  }
  const pickup = String(body.pickup || "").trim();
  const destination = String(body.destination || "").trim();
  if (!pickup || !destination) {
    return Response.json({ error: "Pickup and destination are required" }, { status: 400 });
  }
  const direction = String(body.direction || `Private: ${pickup} to ${destination}`).slice(0, 120);

  // Prefer a vehicle chosen by the customer (may be empty -> ops assigns later)
  let vehicleCode = String(body.vehicle_code || "").trim() || null;
  if (vehicleCode) {
    const { rows: v } = await query(
      "SELECT 1 FROM vehicle WHERE vehicle_code = $1 AND deleted = FALSE",
      [vehicleCode]
    );
    if (!v.length) vehicleCode = null;
  }

  const quote = await autoQuote({ direction, vehicleCode, pickup, destination });

  const result = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO private_hire(service_date, customer, phone, service_type, pickup, destination,
                                start_time, end_time, vehicle_id, quoted_amount, amount_paid,
                                status, quote_status, notes, source, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,'Inquiry','Auto',$11,'portal',$12)
       RETURNING *`,
      [
        serviceDate,
        session.full_name,
        session.phone,
        String(body.service_type || "Standard seat"),
        pickup,
        destination,
        String(body.start_time || "").trim() || null,
        String(body.end_time || "").trim() || null,
        vehicleCode,
        quote.estimate,
        `Auto-quote: GHS ${quote.estimate} (${quote.km} km @ GHS ${quote.vehicleRate}/km + base GHS ${quote.base} + fuel GHS ${quote.fuelCost} for ${quote.litres}L at ${quote.kmPerLitre} km/L). MD/dispatcher to confirm.`,
        session.id,
      ]
    );
    return rows[0];
  });

  return Response.json(
    {
      data: result,
      quote,
      message: "Request received. Your quote is GHS " + quote.estimate + " - we will confirm shortly.",
    },
    { status: 201 }
  );
});