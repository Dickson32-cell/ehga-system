import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "./db";

export const ROLES = {
  MANAGING_DIRECTOR: "MANAGING_DIRECTOR",
  HR: "HR",
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
    email: user.email || null,
    must_change_password: user.must_change_password === true,
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
  // Staff sign in with username OR the email on file (e.g. the CEO signs in
  // with Maxi2g9@yahoo.com). Normalise case; usernames are stored lowercase.
  const id = String(username || "").trim().toLowerCase();
  const { rows } = await query(
    "SELECT id, username, full_name, role, password_hash, active, email, must_change_password FROM app_user WHERE LOWER(username) = $1 OR LOWER(COALESCE(email,'')) = $1 LIMIT 2",
    [id]
  );
  if (rows.length > 1) {
    // email/username collision: prefer exact username match
    return rows.find((r) => r.username.toLowerCase() === id) || rows[0];
  }
  return rows[0] || null;
}

/**
 * Staff-management permission matrix.
 *
 *   MANAGING_DIRECTOR (CEO)  — oversees ALL: sees every staff member; may
 *                              add/edit/delete any role (HR, Operations Manager,
 *                              Accountant, Driver, Rider) and reset any password.
 *   HR                       — field staffing: sees ONLY drivers and riders; may
 *                              add/edit/reactivate them. Cannot see or touch
 *                              MD/HR/Ops/Accountant accounts, cannot delete
 *                              accounts, cannot issue password resets.
 *   OPERATIONS_MANAGER       — runs operations + fuel. NO staff management.
 *   ACCOUNTANT               — deposits/cash reconciliation. NO staff management.
 */
export const STAFF_MANAGE_ROLES = {
  MANAGING_DIRECTOR: ["HR", "OPERATIONS_MANAGER", "ACCOUNTANT", "DISPATCHER", "DRIVER", "RIDER"],
  HR: ["DRIVER", "RIDER"],
};

export function canManage(session) {
  return Boolean(STAFF_MANAGE_ROLES[session?.role]);
}

/** Which roles this session may create/edit. */
export function manageableRoles(session) {
  return STAFF_MANAGE_ROLES[session?.role] || [];
}

/** Guard for the staff APIs. Throws 403 for everyone else. */
export async function requireStaffManager() {
  const session = await requireSession();
  if (!canManage(session)) {
    const err = new Error("Forbidden for role " + session.role);
    err.status = 403;
    throw err;
  }
  return session;
}
