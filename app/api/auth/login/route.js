import bcrypt from "bcryptjs";
import { findUserByUsername, createSessionToken, SESSION_COOKIE, apiHandler } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) {
    return Response.json({ error: "Username and password are required" }, { status: 400 });
  }

  // Brute-force guard: 10 attempts per username or IP per 10 minutes.
  const key = `staff:${username.toLowerCase()}|${clientIp(req)}`;
  const limited = rateLimit(key, 10, 10 * 60 * 1000);
  if (limited) {
    return Response.json(
      { error: `Too many sign-in attempts. Try again in ${Math.ceil(limited.retryAfterSec / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const user = await findUserByUsername(username);
  if (!user || !user.active) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await createSessionToken(user);
  const res = Response.json({
    ok: true,
    user: { username: user.username, full_name: user.full_name, role: user.role },
    must_change_password: user.must_change_password === true,
  });
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${12 * 3600}`
  );
  return res;
});
