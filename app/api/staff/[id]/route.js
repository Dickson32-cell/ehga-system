import { requireStaffManager, manageableRoles, STAFF_MANAGE_ROLES, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH { full_name?, username?, role?, active?, password?, email? }
 *   CEO (MANAGING_DIRECTOR): edit any staff record — details, role, active,
 *   temporary password. CEO-issued password forces change at next login.
 *   Operations Manager: may edit Drivers/Riders only (details + active);
 *   no role changes, no password resets, never touches MD/Ops/Accountant.
 */
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireStaffManager();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const { rows } = await query("SELECT * FROM app_user WHERE id = $1", [id]);
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });
  const target = rows[0];

  // Visibility guard: Ops Managers may only touch drivers and riders.
  if (!STAFF_MANAGE_ROLES[session.role].includes(target.role)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (String(id) === String(session.sub) && body.active === false) {
    return Response.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const isCEO = session.role === "MANAGING_DIRECTOR";
  const sets = [];
  const params = [id];

  if (body.full_name !== undefined) {
    const v = String(body.full_name).trim();
    if (!v) return Response.json({ error: "Full name cannot be empty" }, { status: 400 });
    params.push(v); sets.push(`full_name = $${params.length}`);
  }
  if (body.username !== undefined) {
    const v = String(body.username).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(v)) {
      return Response.json({ error: "Username: 3+ chars, letters/numbers/dots/dashes only" }, { status: 400 });
    }
    const dupe = await query("SELECT 1 FROM app_user WHERE username = $1 AND id <> $2", [v, id]);
    if (dupe.rows.length) return Response.json({ error: "That username is already taken" }, { status: 409 });
    params.push(v); sets.push(`username = $${params.length}`);
  }
  if (body.role !== undefined) {
    // Role changes are a CEO power, and the target role must be in the CEO's own matrix.
    if (!isCEO) return Response.json({ error: "Only the CEO can change roles" }, { status: 403 });
    const ROLES = manageableRoles(session);
    if (!ROLES.includes(body.role)) return Response.json({ error: "invalid role" }, { status: 400 });
    params.push(body.role); sets.push(`role = $${params.length}`);
  }
  if (body.email !== undefined) {
    params.push(String(body.email).trim() || null); sets.push(`email = $${params.length}`);
  }
  if (body.active !== undefined) { params.push(body.active === true); sets.push(`active = $${params.length}`); }
  if (body.password) {
    if (!isCEO) return Response.json({ error: "Only the CEO can reset passwords" }, { status: 403 });
    if (String(body.password).length < 8) return Response.json({ error: "password must be at least 8 characters" }, { status: 400 });
    params.push(await bcrypt.hash(String(body.password), 10));
    sets.push(`password_hash = $${params.length}`);
    // CEO-set password is temporary: staff must replace it at first login.
    if (String(id) !== String(session.sub)) {
      sets.push("must_change_password = TRUE");
      sets.push("password_changed_at = NULL");
    }
  }
  if (!sets.length) return Response.json({ error: "Nothing to update" }, { status: 400 });
  const updated = await query(
    `UPDATE app_user SET ${sets.join(", ")} WHERE id = $1
     RETURNING id, username, full_name, role, active, email, must_change_password, password_changed_at, created_at`,
    params
  );
  return Response.json({ data: updated.rows[0] });
});

/**
 * DELETE — CEO only. Permanently removes the staff account. The CEO cannot
 * delete their own account or the last active MANAGING_DIRECTOR.
 */
export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireStaffManager();
  if (session.role !== "MANAGING_DIRECTOR") {
    return Response.json({ error: "Only the CEO can delete accounts" }, { status: 403 });
  }
  const { id } = await ctx.params;

  if (String(id) === String(session.sub)) {
    return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const { rows } = await query("SELECT id, username, role FROM app_user WHERE id = $1", [id]);
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });

  if (rows[0].role === "MANAGING_DIRECTOR") {
    const md = await query("SELECT count(*)::int n FROM app_user WHERE role = 'MANAGING_DIRECTOR' AND active = TRUE");
    if (md.rows[0].n <= 1) {
      return Response.json({ error: "Cannot delete the last Managing Director account" }, { status: 400 });
    }
  }

  await query("DELETE FROM app_user WHERE id = $1", [id]);
  return Response.json({ data: { id: Number(id), deleted: true, username: rows[0].username } });
});