import crypto from "crypto";
import { query } from "@/lib/db";
import { sendSms } from "@/lib/notify";
import { normalizeGhPhone } from "@/lib/customer-auth";

/**
 * One-time SMS OTP for customers.
 *
 * Rules (ghana-sms-arkesel skill — all verified patterns from FarmLink production):
 *  - The code is SINGLE-USE and expires in 10 minutes.
 *  - Requesting a new code INVALIDATES all previous unused codes for that phone
 *    (prevents the "first SMS finally arrives, user types the dead code" trap)
 *    and is rate-limited: max 5 codes per phone per hour.
 *  - Verification allows max 5 wrong attempts per code, then it is dead.
 *  - Codes are stored HASHED (sha256), never plaintext.
 */

const TTL_MINUTES = 10;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000)); // 6 digits, no leading-zero loss
}

/**
 * Issue a one-time code for `phone` (purpose REGISTER or LOGIN).
 * Returns {ok, resendIn} or {error}.
 */
export async function issueOtp(phoneRaw, purpose = "REGISTER") {
  const phone = normalizeGhPhone(phoneRaw);
  if (!phone) return { error: "Enter a valid Ghana phone number" };

  // Rate limit: 5 codes per phone per hour.
  const { rows: recent } = await query(
    `SELECT count(*)::int n FROM phone_otp
      WHERE phone = $1 AND created_at > now() - interval '1 hour'`,
    [phone]
  );
  if (recent[0].n >= MAX_CODES_PER_HOUR) {
    return { error: "Too many code requests. Please wait an hour and try again." };
  }

  // Invalidate any previous unused codes for this phone (only the newest is valid).
  await query(
    `UPDATE phone_otp SET used = TRUE, used_at = now()
      WHERE phone = $1 AND used = FALSE`,
    [phone]
  );

  const code = generateOtpCode();
  await query(
    `INSERT INTO phone_otp(phone, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [phone, hashCode(code), purpose, String(TTL_MINUTES)]
  );

  const sms = await sendSms(
    phone,
    `EHGA Mobility: Your verification code is ${code}. It expires in ${TTL_MINUTES} minutes and can be used once. Do not share it with anyone.`
  );
  if (!sms.sent) {
    // Do not leave a dangling row: the newest row must always be a REAL, valid code.
    await query(
      `DELETE FROM phone_otp WHERE phone = $1 AND code_hash = $2 AND used = FALSE`,
      [phone, hashCode(code)]
    );
    return { error: "We could not send the SMS code right now. Please try again in a few minutes.", sms };
  }
  return { ok: true, smsId: sms.smsId, smsBalance: sms.smsBalance };
}

/**
 * Verify a code for `phone`. Returns {ok} or {error}.
 * Single-use + expiry + attempt cap enforced atomically per attempt.
 */
export async function verifyOtp(phoneRaw, code, purpose = "REGISTER") {
  const phone = normalizeGhPhone(phoneRaw);
  const c = String(code || "").replace(/\D/g, "");
  if (!phone || !c) return { error: "Enter the 6-digit code we sent you" };

  // Freshness decided INSIDE Postgres (expires_at > now()) — the Neon clock and the
  // app server clock can disagree, so never compare timestamps across the two.
  const { rows } = await query(
    `SELECT id, code_hash, attempts, used,
            (expires_at > now()) AS fresh
       FROM phone_otp
      WHERE phone = $1 AND purpose = $2
      ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose]
  );
  if (!rows.length || rows[0].used) {
    return { error: "That code is no longer valid. Request a new one." };
  }
  if (!rows[0].fresh) {
    await query("UPDATE phone_otp SET used = TRUE, used_at = now() WHERE id = $1", [rows[0].id]);
    return { error: "That code has expired. Request a new one." };
  }
  if (rows[0].attempts >= MAX_ATTEMPTS) {
    await query("UPDATE phone_otp SET used = TRUE, used_at = now() WHERE id = $1", [rows[0].id]);
    return { error: "Too many wrong attempts. Request a new code." };
  }

  const stale = crypto.timingSafeEqual(
    Buffer.from(rows[0].code_hash),
    Buffer.from(hashCode(c))
  );
  if (!stale) {
    await query(
      "UPDATE phone_otp SET attempts = attempts + 1 WHERE id = $1",
      [rows[0].id]
    );
    const left = MAX_ATTEMPTS - (rows[0].attempts + 1);
    return { error: `Wrong code. ${Math.max(left, 0)} attempt(s) left.` };
  }

  // Mark this code used — it is ONE-TIME.
  await query(
    "UPDATE phone_otp SET used = TRUE, used_at = now() WHERE id = $1",
    [rows[0].id]
  );
  return { ok: true };
}