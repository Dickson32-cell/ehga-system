import { requireRole, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireRole("MANAGING_DIRECTOR");
  const { rows } = await query(
    "SELECT id, username, full_name, role, active, created_at FROM app_user ORDER BY id"
  );
  return Response.json({ data: rows });
});

/** POST { username, full_name, role, password } - creates a staff user. */
export const POST = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR");
  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").trim().toLowerCase();
  const fullName = (body.full_name || "").trim();
  const role = body.role || "";
  const password = body.password || "";
  const ROLES = ["MANAGING_DIRECTOR","OPERATIONS_MANAGER","DISPATCHER","ACCOUNTANT","DRIVER","RIDER"];
  if (!username || !fullName || !role || !password) {
    return Response.json({ error: "username, full_name, role and password are required" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return Response.json({ error: "role must be one of " + ROLES.join(", ") }, { status: 400 });
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
    "INSERT INTO app_user(username, full_name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, username, full_name, role, active, created_at",
    [username, fullName, role, hash]
  );
  return Response.json({ data: rows[0] }, { status: 201 });
});
