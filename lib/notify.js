/**
 * WhatsApp deep links + optional Arkesel SMS fallback.
 * No credentials required for WhatsApp (wa.me links); Arkesel only used if
 * ARKESEL_API_KEY is configured on the server.
 */

export function waLink(phone, text) {
  const p = String(phone || "").replace(/[^\d]/g, "");
  const msg = encodeURIComponent(String(text || ""));
  return `https://wa.me/${p}?text=${msg}`;
}

export function waBookingText(b) {
  return [
    "NEW BOOKING - EHGA Mobility",
    `Code: ${b.booking_code}`,
    `Route: ${b.direction}`,
    `Date: ${b.travel_date} ${b.departure_time || ""}`.trim(),
    `Name: ${b.customer_name}`,
    `Phone: ${b.phone || "-"}`,
    `Seats: ${b.seats} x GHS ${b.fare_per_seat}`,
    `Pickup: ${b.pickup_point || "-"}`,
    `Drop-off: ${b.dropoff_point || "-"}`,
  ].join("\n");
}

export function waParcelText(p) {
  return [
    "NEW PARCEL - EHGA Mobility",
    `Code: ${p.parcel_code}`,
    `From: ${p.sender} (${p.sender_phone || "-"})`,
    `To: ${p.recipient} (${p.recipient_phone || "-"})`,
    `Pickup: ${p.pickup_address || "-"}`,
    `Deliver to: ${p.delivery_address || "-"}`,
    `Size: ${p.size}`,
    `Total: GHS ${p.total_charge}`,
  ].join("\n");
}

/**
 * SMS fallback (alerts reach basic phones too). Uses Arkesel v1 API.
 * Returns {sent, reason} - never throws; SMS failure must not break bookings.
 */
export async function sendSms(to, message) {
  const key = process.env.ARKESEL_API_KEY;
  if (!key) return { sent: false, reason: "ARKESEL_API_KEY not configured" };
  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: process.env.ARKESEL_SENDER || "EHGAMobility",
        message: String(message).slice(0, 480),
        recipients: [String(to).replace(/[^\d+]/g, "")],
      }),
    });
    const j = await res.json().catch(() => ({}));
    return { sent: res.ok && (j.status === "success" || j.code === "ok"), reason: j.message || res.status };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}