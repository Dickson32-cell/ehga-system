import { apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createCustomerToken, CUSTOMER_COOKIE, normalizeGhPhone } from "@/lib/customer-auth";
import { verifyOtp } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { full_name, phone, code, password } — step 2 of registration.
 * Verifies the ONE-TIME SMS code; on success creates the account (already
 * phone-verified) and signs the customer in.
 */
export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || "").trim();
  const phone = normalizeGhPhone(body.phone);
  const password = String(body.password || "");
  const code = String(body.code || "");

  if (!fullName || fullName.length < 3) {
    return Response.json({ error: "Please enter your full name" }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "Enter a valid Ghana phone number" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const v = await verifyOtp(phone, code, "REGISTER");
  if (v.error) {
    return Response.json({ error: v.error }, { status: 401 });
  }

  // Re-check uniqueness (code was verified, but the phone could have registered
  // between step 1 and step 2).
  const exists = await query("SELECT 1 FROM customer WHERE phone = $1", [phone]);
  if (exists.rows.length) {
    return Response.json(
      { error: "This phone number already has an account. Please sign in instead." },
      { status: 409 }
    );
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    "INSERT INTO customer(full_name, phone, password_hash, phone_verified) VALUES ($1,$2,$3,TRUE) RETURNING id, full_name, phone",
    [fullName, phone, hash]
  );
  const customer = rows[0];
  const token = await createCustomerToken(customer);
  const res = Response.json({ ok: true, customer }, { status: 201 });
  res.headers.append(
    "Set-Cookie",
    `${CUSTOMER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
  );
  return res;
});