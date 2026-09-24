import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/portal/profile — the signed-in customer's own profile (plus a
 * small activity summary). Row-level: WHERE id = session id.
 * PATCH /api/portal/profile — edit full_name and/or change password.
 *   { full_name?, current_password?, next_password? }
 * Phone is the identity and is NOT editable here.
 */
export const GET = apiHandler(async () => {
  const me = await requireCustomer();
  const { rows } = await query(
    `SELECT id, full_name, phone, active, created_at,
            avatar_mimetype IS NOT NULL AND avatar_data IS NOT NULL AS has_avatar
       FROM customer WHERE id = $1`,
    [me.id]
  );
  const c = rows[0];
  if (!c) return Response.json({ error: "Account not found" }, { status: 404 });

  const { rows: counts } = await query(
    `SELECT
       (SELECT count(*)::int FROM booking WHERE customer_id = $1 AND deleted = FALSE)      AS bookings,
       (SELECT count(*)::int FROM parcel WHERE customer_id = $1 AND deleted = FALSE)       AS parcels,
       (SELECT count(*)::int FROM private_hire WHERE customer_id = $1 AND deleted = FALSE) AS hires,
       (SELECT count(*)::int FROM school_student WHERE customer_id = $1 AND deleted = FALSE) AS school`,
    [me.id]
  );

  return Response.json({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    member_since: c.created_at,
    has_avatar: !!c.avatar_mimetype,
    activity: counts[0] || { bookings: 0, parcels: 0, hires: 0, school: 0 },
  });
});

export const PATCH = apiHandler(async (req) => {
  const me = await requireCustomer();
  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || "").trim();
  const currentPassword = String(body.current_password || "");
  const nextPassword = String(body.next_password || "");

  const passwordOnly = !!(currentPassword || nextPassword);

  if (!passwordOnly && (!fullName || fullName.length > 80)) {
    return Response.json({ error: "Enter your full name (max 80 characters)" }, { status: 400 });
  }
  if (!passwordOnly) {
    await query("UPDATE customer SET full_name = $1 WHERE id = $2", [fullName, me.id]);
    return Response.json({ ok: true });
  }

  // Password change: verify the current one before accepting the new one.
  if (nextPassword) {
    if (nextPassword.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    if (!currentPassword) {
      return Response.json({ error: "Enter your current password to change it" }, { status: 400 });
    }
    const { rows } = await query(
      "SELECT password_hash FROM customer WHERE id = $1",
      [me.id]
    );
    const ok = rows[0] && (await bcrypt.compare(currentPassword, rows[0].password_hash));
    if (!ok) {
      return Response.json({ error: "Current password is not correct" }, { status: 401 });
    }
    const hash = await bcrypt.hash(nextPassword, 10);
    await query("UPDATE customer SET password_hash = $1 WHERE id = $2", [hash, me.id]);
  }

  if (fullName && fullName.length <= 80) {
    await query("UPDATE customer SET full_name = $1 WHERE id = $2", [fullName, me.id]);
  }

  return Response.json({ ok: true });
});