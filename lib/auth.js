import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "./db";

export const ROLES = {
  MANAGING_DIRECTOR: "MANAGING_DIRECTOR",
  OPERATIONS_MANAGER: "OPERATIONS_MANAGER",
  DISPATCHER: "DISPATCHER",
  ACCOUNTANT: "ACCOUNTANT",
  DRIVER: "DRIVER",
  RIDER: "RIDER",
};

export const SESSION_COOKIE = "ehga_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user) {
  return new SignJWT({
    sub: String(user.id),
    username: user.username,
    full_name: user.full_name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }
  return session;
}

export async function requireRole(...roles) {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    const err = new Error("Forbidden for role " + session.role);
    err.status = 403;
    throw err;
  }
  return session;
}

/** Route handlers must run on Node.js runtime (pg + jose are used there). */
export function apiHandler(fn) {
  return async (req, ctx) => {
    try {
      const res = await fn(req, ctx);
      return res;
    } catch (err) {
      const status = err.status || 500;
      const message =
        status === 500 ? "Internal server error" : err.message || "Error";
      if (status === 500) console.error(err);
      return Response.json({ error: message }, { status });
    }
  };
}

export async function findUserByUsername(username) {
  const { rows } = await query(
    "SELECT id, username, full_name, role, password_hash, active FROM app_user WHERE username = $1",
    [username]
  );
  return rows[0] || null;
}
