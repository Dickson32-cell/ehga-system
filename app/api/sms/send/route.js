import { apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendSms } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sms/send { to, message } - staff-triggered SMS fallback
 * ("alerts reach basic phones too"). Uses Arkesel when ARKESEL_API_KEY is set;
 * otherwise reports not-configured so staff fall back to WhatsApp/phone.
 */
export const POST = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER", "ACCOUNTANT");
  const body = await req.json().catch(() => ({}));
  const to = String(body.to || "");
  const message = String(body.message || "").slice(0, 480);
  const phone = normalizeGhPhone(to) || (/^\+?\d{9,15}$/.test(to) ? to : null);
  if (!phone || !message) {
    return Response.json({ error: "to (Ghana phone) and message are required" }, { status: 400 });
  }
  const result = await sendSms(phone, message);
  return Response.json({ ok: true, ...result });
});