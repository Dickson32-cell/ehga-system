import { apiHandler, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { current_password, new_password } — signed-in staff changes their OWN
 * password. Used to replace the CEO-issued temporary password at first login
 * (must_change_password) or anytime afterwards. Clears the must-change flag
 * and stamps password_changed_at so the CEO can see it was done.
 */
export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const body = await req.json().catch(() => ({}));
  const current = String(body.current_password || "");
  const next = String(body.new_password || "");

  if (!current || !next) {
    return Response.json({ error: "Current and new password are required" }, { status: 400 });
  }
  if (next.length < 8) {
    return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }
  if (next === current) {
    return Response.json({ error: "New password must be different from the current one" }, { status: 400 });
  }

  const { rows } = await query("SELECT password_hash FROM app_user WHERE id = $1", [session.sub]);
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });

  const ok = await bcrypt.compare(current, rows[0].password_hash);
  if (!ok) return Response.json({ error: "Current password is incorrect" }, { status: 401 });

  await query(
    `UPDATE app_user
        SET password_hash = $1, must_change_password = FALSE, password_changed_at = now()
      WHERE id = $2`,
    [await bcrypt.hash(next, 10), session.sub]
  );
  return Response.json({ ok: true, message: "Password changed. Use it from your next sign-in." });
});