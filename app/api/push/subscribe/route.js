import { apiHandler, getSession } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/push/subscribe — save this browser as a push target.
 * Body: { endpoint, keys: { p256dh, auth } } from PushManager.subscribe().
 * Works for a signed-in staff member OR customer; audience derived from the
 * session that made the call. Duplicate endpoint -> refresh keys, not a new row.
 */
export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "");
  const p256dh = body.keys?.p256dh || "";
  const auth = body.keys?.auth || "";
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const staff = await getSession().catch(() => null);
  const customer = staff ? null : await getCustomerSession();
  if (!staff && !customer) {
    return Response.json({ error: "Sign in first" }, { status: 401 });
  }
  const audience = staff ? "staff" : "customer";
  // Staff JWT carries the user id in `sub` (no `id` claim); customer sessions resolve id.
  const subjectId = staff ? Number(staff.sub) : customer.id;
  if (!Number.isInteger(subjectId)) {
    return Response.json({ error: "Invalid session subject" }, { status: 401 });
  }

  await query(
    `INSERT INTO push_subscription (audience, subject_id, endpoint, p256dh, auth, user_agent, active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     ON CONFLICT (endpoint) DO UPDATE
       SET p256dh = $4, auth = $5, active = TRUE, last_error = NULL, user_agent = $6`,
    [
      audience,
      subjectId,
      endpoint,
      p256dh,
      auth,
      (req.headers.get("user-agent") || "").slice(0, 250),
    ]
  );

  return Response.json({ ok: true });
});

/**
 * DELETE /api/push/subscribe — user turns notifications off (or logout).
 */
export const DELETE = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "");
  if (!endpoint) return Response.json({ error: "endpoint required" }, { status: 400 });
  await query("UPDATE push_subscription SET active = FALSE WHERE endpoint = $1", [endpoint]);
  return Response.json({ ok: true });
});

/**
 * GET /api/push/subscribe — whether VAPID is configured + my subscription count.
 */
export const GET = apiHandler(async () => {
  const staff = await getSession().catch(() => null);
  const customer = staff ? null : await getCustomerSession();
  if (!staff && !customer) {
    return Response.json({ error: "Sign in first" }, { status: 401 });
  }
  return Response.json({
    configured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    public_key: process.env.VAPID_PUBLIC_KEY || null,
    applicationServerKey: process.env.VAPID_PUBLIC_KEY || null,
  });
});