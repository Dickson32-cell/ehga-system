import { apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createCustomerToken, CUSTOMER_COOKIE, normalizeGhPhone } from "@/lib/customer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { full_name, phone, password } - customer self-registration.
 * No SMS OTP (client decision): the UNIQUE phone number is the identity guard —
 * the same number can never register twice; a second attempt gets a clear
 * "already has an account, sign in instead" message.
 */
export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || "").trim();
  const phone = normalizeGhPhone(body.phone);
  const password = String(body.password || "");

  if (!fullName || fullName.length < 3) {
    return Response.json({ error: "Please enter your full name" }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "Enter a valid Ghana phone number, e.g. 024 123 4567" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const exists = await query("SELECT 1 FROM customer WHERE phone = $1", [phone]);
  if (exists.rows.length) {
    return Response.json(
      { error: "This phone number already has an account. Please sign in instead." },
      { status: 409 }
    );
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    "INSERT INTO customer(full_name, phone, password_hash) VALUES ($1,$2,$3) RETURNING id, full_name, phone",
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