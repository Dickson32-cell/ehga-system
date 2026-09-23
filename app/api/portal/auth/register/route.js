import { apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/customer-auth";
import { issueOtp } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { full_name, phone } — step 1 of registration: validate details, then
 * send a ONE-TIME SMS code to the customer's phone. The account is NOT
 * created until step 2 verifies the code.
 */
export const POST = apiHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || "").trim();
  const phone = normalizeGhPhone(body.phone);

  if (!fullName || fullName.length < 3) {
    return Response.json({ error: "Please enter your full name" }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "Enter a valid Ghana phone number, e.g. 024 123 4567" }, { status: 400 });
  }

  const exists = await query("SELECT 1 FROM customer WHERE phone = $1", [phone]);
  if (exists.rows.length) {
    return Response.json(
      { error: "This phone number already has an account. Please sign in instead." },
      { status: 409 }
    );
  }

  const result = await issueOtp(phone, "REGISTER");
  if (result.error) {
    return Response.json({ error: result.error }, { status: 429 });
  }
  return Response.json({
    ok: true,
    step: "verify",
    message: `We sent a 6-digit code by SMS to ${phone}. It expires in 10 minutes and works once.`,
  });
});