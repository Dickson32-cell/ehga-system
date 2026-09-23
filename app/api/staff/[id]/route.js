import { requireRole, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH { full_name?, role?, active?, password? } - MANAGING_DIRECTOR only. */
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireRole("MANAGING_DIRECTOR");
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const { rows } = await query("SELECT * FROM app_user WHERE id = $1", [id]);
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });

  if (String(id) === String(session.id) && body.active === false) {
    return Response.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const sets = [];
  const params = [id];
  if (body.full_name !== undefined) { params.push(String(body.full_name)); sets.push(`full_name = $${params.length}`); }
  if (body.role !== undefined) {
    const ROLES = ["MANAGING_DIRECTOR","OPERATIONS_MANAGER","DISPATCHER","ACCOUNTANT","DRIVER","RIDER"];
    if (!ROLES.includes(body.role)) return Response.json({ error: "invalid role" }, { status: 400 });
    params.push(body.role); sets.push(`role = $${params.length}`);
  }
  if (body.active !== undefined) { params.push(body.active === true); sets.push(`active = $${params.length}`); }
  if (body.password) {
    if (String(body.password).length < 8) return Response.json({ error: "password must be at least 8 characters" }, { status: 400 });
    params.push(await bcrypt.hash(String(body.password), 10));
    sets.push(`password_hash = $${params.length}`);
  }
  if (!sets.length) return Response.json({ error: "Nothing to update" }, { status: 400 });
  const updated = await query(
    `UPDATE app_user SET ${sets.join(", ")} WHERE id = $1 RETURNING id, username, full_name, role, active, created_at`,
    params
  );
  return Response.json({ data: updated.rows[0] });
});
