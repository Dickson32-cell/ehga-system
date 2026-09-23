import { apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createCustomerToken, CUSTOMER_COOKIE, normalizeGhPhone } from "@/lib/customer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { phone, password } - customer sign-in. */
export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeGhPhone(body.phone);
  const password = String(body.password || "");

  if (!phone) {
    return Response.json({ error: "Enter the phone number you registered with" }, { status: 400 });
  }

  const { rows } = await query(
    "SELECT id, full_name, phone, password_hash, active FROM customer WHERE phone = $1",
    [phone]
  );
  const customer = rows[0];
  if (!customer || !customer.active) {
    return Response.json({ error: "No account found for this phone number" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, customer.password_hash);
  if (!ok) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createCustomerToken(customer);
  const res = Response.json({
    ok: true,
    customer: { id: customer.id, full_name: customer.full_name, phone: customer.phone },
  });
  res.headers.append(
    "Set-Cookie",
    `${CUSTOMER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
  );
  return res;
});