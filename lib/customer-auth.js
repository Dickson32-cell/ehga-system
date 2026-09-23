import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "./db";

/**
 * Customer portal sessions are a SEPARATE cookie + token type from staff
 * sessions (customer_session / csub claim) so neither can be confused with
 * the other. Customer tokens only ever carry customer_id — never roles.
 */
export const CUSTOMER_COOKIE = "ehga_customer";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createCustomerToken(customer) {
  return new SignJWT({
    sub: String(customer.id),
    kind: "customer",
    full_name: customer.full_name,
    phone: customer.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyCustomerToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "customer") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCustomerSession() {
  const store = cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyCustomerToken(token);
  if (!payload) return null;
  // Confirm the account is still active (cheap single lookup)
  const { rows } = await query(
    "SELECT id, full_name, phone, active FROM customer WHERE id = $1",
    [Number(payload.sub)]
  );
  const c = rows[0];
  if (!c || !c.active) return null;
  return { id: c.id, full_name: c.full_name, phone: c.phone };
}

export async function requireCustomer() {
  const session = await getCustomerSession();
  if (!session) {
    const err = new Error("Customer authentication required");
    err.status = 401;
    throw err;
  }
  return session;
}

/** Normalise Ghana phone numbers to +233XXXXXXXXX canonical form. */
export function normalizeGhPhone(input) {
  let p = String(input || "").replace(/[^\d+]/g, "");
  if (p.startsWith("+233")) p = "0" + p.slice(4);
  if (p.startsWith("233")) p = "0" + p.slice(3);
  if (/^0\d{9}$/.test(p)) return "+233" + p.slice(1);
  return null;
}