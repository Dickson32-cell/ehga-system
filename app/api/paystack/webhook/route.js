import { apiHandler } from "@/lib/auth";
import { query, tx } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/customer-auth";
import { rateLimit, clientIp, safeEqual } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/paystack/webhook - Paystack charge.success webhook. Verifies the
 * x-paystack-signature HMAC SHA512 against PAYSTACK_SECRET_KEY, then marks the
 * matching momo_transaction Paid and posts the amount to the register row.
 * (Node crypto, no dependency needed.)
 */
import crypto from "crypto";

export const POST = apiHandler(async (req) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return Response.json({ error: "Gateway not configured" }, { status: 501 });

  // Webhook flood guard: 100 verified-ish requests per IP per 10 minutes.
  const limited = rateLimit(`paystack:${clientIp(req)}`, 100, 10 * 60 * 1000);
  if (limited) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  if (!safeEqual(signature, expected)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bad payload" }, { status: 400 });
  }

  if (event.event === "charge.success" && event.data?.reference) {
    const { rows } = await query(
      "SELECT * FROM momo_transaction WHERE reference = $1 AND status <> 'Paid'",
      [event.data.reference]
    );
    const t = rows[0];
    if (t) {
      await tx(async (client) => {
        await client.query(
          "UPDATE momo_transaction SET status = 'Paid', paid_at = now(), provider_ref = $1 WHERE id = $2",
          [event.data.id ? String(event.data.id) : t.reference, t.id]
        );
        const map = {
          BOOKING: ["booking", "amount_paid"],
          PARCEL: ["parcel", "amount_paid"],
          PRIVATE_HIRE: ["private_hire", "amount_paid"],
          SCHOOL: ["school_student", "amount_paid"],
        };
        const m = map[t.subject_type];
        if (m) {
          await client.query(`UPDATE ${m[0]} SET ${m[1]} = ${m[1]} + $1 WHERE id = $2`, [t.amount, t.subject_id]);
        }
      });
    }
  }

  return Response.json({ ok: true });
});