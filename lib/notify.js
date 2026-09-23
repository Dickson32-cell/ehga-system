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
 * SMS fallback (alerts reach basic phones too). Uses Arkesel v2 API.
 * Returns {sent, reason, smsId} - never throws; SMS failure must not break bookings.
 *
 * Hygiene rules (ghana-sms-arkesel skill):
 *  - ONE page: hard cap 160 chars (multi-page reassembly corrupts on cheap handsets)
 *  - GSM-7 ASCII only: cedi sign/arrows/dashes mapped or stripped (GHS, not ₵)
 *  - no email addresses in bodies
 *  - browser User-Agent REQUIRED (Cloudflare 1010 blocks bare fetch otherwise)
 *  - persist the returned sms id ([SMS-TRACK] log) — there is NO list endpoint
 */
function smsSanitize(raw) {
  let m = String(raw)
    .replace(/GH₵/gi, "GHS")
    .replace(/₵/g, "GHS ")
    .replace(/[→…–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
  m = m.replace(/ {2,}/g, " ").trim();
  if (m.length > 160) m = m.slice(0, 157).trimEnd() + "...";
  return m;
}

export async function sendSms(to, message) {
  const key = process.env.ARKESEL_API_KEY;
  const text = smsSanitize(message);
  if (!key) return { sent: false, reason: "ARKESEL_API_KEY not configured" };
  if (!text) return { sent: false, reason: "empty message after sanitize" };
  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": key,
        "Content-Type": "application/json",
        // Cloudflare 1010 blocks non-browser agents on sms.arkesel.com
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
      body: JSON.stringify({
        sender: process.env.ARKESEL_SENDER || "EHGAMobility",
        message: text,
        recipients: [String(to).replace(/[^\d+]/g, "")],
      }),
    });
    const j = await res.json().catch(() => ({}));
    const smsId = j?.data?.[0]?.id || null;
    if (smsId) console.log(`[SMS-TRACK] to=${to} id=${smsId} :: ${text.slice(0, 60)}`);
    return {
      sent: res.ok && (j.status === "success" || j.code === "ok"),
      reason: j.message || res.status,
      smsId,
      smsBalance: j.sms_balance,
    };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}