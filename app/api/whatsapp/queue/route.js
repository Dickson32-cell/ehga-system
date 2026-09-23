import { apiHandler, requireRole } from "@/lib/auth";
import { query, tx } from "@/lib/db";
import { waLink, waBookingText, waParcelText } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/whatsapp/queue?date=YYYY-MM-DD - portal-sourced bookings & parcels
 * for the date, each with a ready wa.me deep link the dispatcher taps to push
 * the booking into the WhatsApp booking line ("WhatsApp booking line into
 * dispatch board").
 */
export const GET = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER");
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [bookings, parcels, kvrows] = await Promise.all([
    query(
      `SELECT * FROM booking WHERE deleted = FALSE AND source = 'portal' AND travel_date = $1 ORDER BY created_at DESC`,
      [date]
    ),
    query(
      `SELECT * FROM parcel WHERE deleted = FALSE AND source = 'portal' AND booking_date = $1 ORDER BY created_at DESC`,
      [date]
    ),
    query("SELECT value FROM setup_kv WHERE key = 'whatsapp_line'"),
  ]);

  const line = kvrows.rows[0]?.value || "";
  return Response.json({
    line,
    data: [
      ...bookings.rows.map((b) => ({
        kind: "BOOKING",
        code: b.booking_code,
        summary: `${b.direction} - ${b.customer_name} - ${b.seats} seat(s) - GHS ${b.passenger_revenue}`,
        status: b.status,
        created_at: b.created_at,
        wa_url: waLink(line, waBookingText(b)),
      })),
      ...parcels.rows.map((p) => ({
        kind: "PARCEL",
        code: p.parcel_code,
        summary: `${p.sender} to ${p.recipient} - ${p.size} - GHS ${p.total_charge}`,
        status: p.status,
        created_at: p.created_at,
        wa_url: waLink(line, waParcelText(p)),
      })),
    ],
  });
});