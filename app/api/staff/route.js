import { requireStaffManager, manageableRoles, STAFF_MANAGE_ROLES, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/staff
 *   CEO sees everyone. Operations Manager sees only drivers and riders.
 */
export const GET = apiHandler(async () => {
  const session = await requireStaffManager();
  const allowed = STAFF_MANAGE_ROLES[session.role];
  const { rows } = await query(
    `SELECT id, username, full_name, role, active, email, must_change_password,
            password_changed_at, created_at
       FROM app_user
      WHERE role = ANY($1)
      ORDER BY id`,
    [allowed]
  );
  return Response.json({ data: rows, my_role: session.role });
});

/**
 * POST { username, full_name, role, password, email? } — creates a staff user.
 *   CEO may create: MD, Operations Manager, Accountant, Driver, Rider.
 *   Operations Manager may create: Driver, Rider (field staffing only).
 * Password is temporary: the account is flagged must_change_password and the
 * staff member sets their own password at first login.
 */
export const POST = apiHandler(async (req) => {
  const session = await requireStaffManager();
  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").trim().toLowerCase();
  const fullName = (body.full_name || "").trim();
  const role = body.role || "";
  const email = (body.email || "").trim() || null;
  const password = body.password || "";
  if (!username || !fullName || !role || !password) {
    return Response.json({ error: "username, full_name, role and password are required" }, { status: 400 });
  }
  const allowed = manageableRoles(session);
  if (!allowed.includes(role)) {
    return Response.json(
      { error: session.role === "MANAGING_DIRECTOR"
        ? "role must be one of " + allowed.join(", ")
        : "As Operations Manager you can only add Drivers and Riders" },
      { status: 403 }
    );
  }
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return Response.json({ error: "Username: 3+ chars, letters/numbers/dots/dashes only" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }
  const exists = await query("SELECT 1 FROM app_user WHERE username = $1", [username]);
  if (exists.rows.length) {
    return Response.json({ error: "username already exists" }, { status: 409 });
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO app_user(username, full_name, role, password_hash, email, must_change_password)
     VALUES ($1,$2,$3,$4,$5,TRUE)
     RETURNING id, username, full_name, role, active, email, must_change_password, created_at`,
    [username, fullName, role, hash, email]
  );
  return Response.json(
    { data: rows[0], message: "Account created. The staff member will be asked to set their own password at first login." },
    { status: 201 }
  );
});