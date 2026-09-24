import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query, tx } from "@/lib/db";
import { waLink, waParcelText } from "@/lib/notify";
import { sendPushToRoles } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET - the customer's parcels only, with live status for tracking. */
export const GET = apiHandler(async () => {
  const session = await requireCustomer();
  const { rows } = await query(
    `SELECT p.id, p.parcel_code, p.booking_date, p.sender, p.recipient, p.recipient_phone,
            p.pickup_address, p.delivery_address, p.description, p.size, p.service,
            p.total_charge, p.amount_paid, p.balance, p.payment_method, p.status,
            p.proof_of_delivery, p.exception_notes,
            v.model AS vehicle_model, v.color AS vehicle_color, v.registration AS vehicle_registration
       FROM parcel p
       LEFT JOIN vehicle v ON v.vehicle_code = p.vehicle_id
      WHERE p.customer_id = $1 AND p.deleted = FALSE
      ORDER BY p.booking_date DESC, p.id DESC LIMIT 100`,
    [session.id]
  );
  return Response.json({ data: rows });
});

/** POST { recipient, recipient_phone, pickup_address, delivery_address, description, size, service } */
export const POST = apiHandler(async (req) => {
  const session = await requireCustomer();
  const body = await req.json().catch(() => ({}));

  const recipient = String(body.recipient || "").trim();
  const size = String(body.size || "Small");
  if (!recipient) return Response.json({ error: "Who is receiving the parcel?" }, { status: 400 });
  if (!String(body.pickup_address || "").trim() || !String(body.delivery_address || "").trim()) {
    return Response.json({ error: "Pickup and delivery addresses are required" }, { status: 400 });
  }
  const SIZES = ["Envelope", "Small", "Medium", "Large", "XL"];
  if (!SIZES.includes(size)) return Response.json({ error: "Choose a parcel size" }, { status: 400 });

  // Charge composition from setup rates (never client-supplied).
  const { rows: kv } = await query("SELECT key, value FROM setup_kv WHERE key IN ('parcel_sizes','fuel_price')");
  const rate = Number(kv.find((r) => r.key === "fuel_price")?.value || 17);
  const sizeFactor = { Envelope: 0.5, Small: 1, Medium: 1.6, Large: 2.4, XL: 3.5 }[size] || 1;
  const intercity = Math.round(20 * sizeFactor * ((rate / 17)) * 2) / 2;
  const pickupCharge = 10;
  const deliveryCharge = 10;

  const result = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO parcel(booking_date, sender, sender_phone, recipient, recipient_phone,
                          pickup_address, delivery_address, description, declared_value, size, service,
                          intercity_charge, pickup_charge, delivery_charge, amount_paid,
                          payment_method, status, source, customer_id)
       VALUES (CURRENT_DATE,$1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,0,'MoMo','Booked','portal',$13)
       RETURNING *`,
      [
        session.full_name,
        session.phone,
        recipient,
        String(body.recipient_phone || "").trim() || null,
        String(body.pickup_address || "").trim(),
        String(body.delivery_address || "").trim(),
        String(body.description || "").trim() || null,
        size,
        String(body.service || "Standard").trim() || "Standard",
        intercity,
        pickupCharge,
        deliveryCharge,
        session.id,
      ]
    );
    return rows[0];
  });

  // Staff alert (fire-and-forget): office sees the new work instantly.
  sendPushToRoles(["OPERATIONS_MANAGER", "DISPATCHER", "MANAGING_DIRECTOR"], {
    title: `New parcel ${result.parcel_code}`,
    body: `A parcel booking was recorded and is awaiting pickup.`,
    url: "/app/parcels",
  }).catch(() => {});

  const { rows: wa } = await query("SELECT value FROM setup_kv WHERE key = 'whatsapp_line'");
  return Response.json(
    {
      data: result,
      whatsapp_url: waLink(wa[0]?.value || "", waParcelText(result)),
      message: "Parcel booked. We will collect it at the pickup address.",
    },
    { status: 201 }
  );
});