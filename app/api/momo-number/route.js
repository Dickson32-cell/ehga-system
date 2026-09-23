import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/customer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/momo-number - public-safe: returns ONLY the payment MoMo number
 * and payee name for the customer portal payment screens. Nothing else.
 */
export const GET = apiHandler(async () => {
  const { rows } = await query(
    "SELECT key, value FROM setup_kv WHERE key IN ('momo_number','momo_payee')"
  );
  const kv = {};
  for (const r of rows) kv[r.key] = r.value;
  return Response.json({
    number: kv.momo_number || null,
    payee: kv.momo_payee || null,
  });
});

/**
 * PUT { number, payee? } - CEO (Managing Director) ONLY. Ops Manager cannot
 * change where the money goes. Ghana number stored in +233 canonical form.
 */
export const PUT = apiHandler(async (req) => {
  const session = await requireRole("MANAGING_DIRECTOR");
  const body = await req.json().catch(() => ({}));

  const canonical = normalizeGhPhone(body.number);
  if (!canonical) {
    return Response.json(
      { error: "Enter a valid Ghana MoMo number, e.g. 024 123 4567" },
      { status: 400 }
    );
  }
  const payee = String(body.payee || "").trim().slice(0, 80) || null;

  for (const [k, v] of [
    ["momo_number", canonical],
    ...(payee ? [["momo_payee", payee]] : []),
  ]) {
    await query(
      "INSERT INTO setup_kv(key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()",
      [k, v]
    );
  }

  return Response.json({
    ok: true,
    set_by: session.full_name || session.username,
    data: { number: canonical, payee },
    message: "Payment MoMo number updated - customers now see it when paying.",
  });
});