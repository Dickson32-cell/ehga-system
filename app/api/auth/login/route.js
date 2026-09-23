import bcrypt from "bcryptjs";
import { findUserByUsername, createSessionToken, SESSION_COOKIE, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) {
    return Response.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = await findUserByUsername(username);
  if (!user || !user.active) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  await query("UPDATE app_user SET created_at = created_at WHERE id = $1", [user.id]);
  const token = await createSessionToken(user);
  const res = Response.json({
    ok: true,
    user: { username: user.username, full_name: user.full_name, role: user.role },
  });
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${12 * 3600}`
  );
  return res;
});
