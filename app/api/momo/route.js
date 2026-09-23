import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MoMo status: lists Paystack/Hubtel transactions and lets staff reconcile
 * them against registers. Payment INITIATION lives on the portal side;
 * this endpoint is the staff "MoMo paid inside the app" control panel.
 */
export const GET = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "ACCOUNTANT");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const params = [];
  let where = "deleted IS NULL";
  // momo_transaction has no deleted column; simple status filter
  where = "TRUE";
  if (status) {
    params.push(status);
    where += " AND status = $" + params.length;
  }
  const { rows } = await query(
    `SELECT m.*, c.full_name AS customer_name FROM momo_transaction m
      LEFT JOIN customer c ON c.id = m.customer_id
      WHERE ${where} ORDER BY m.created_at DESC LIMIT 300`,
    params
  );
  const configured = !!(process.env.PAYSTACK_SECRET_KEY || process.env.HUBTEL_CLIENT_ID);
  return Response.json({ data: rows, gateway_configured: configured });
});

/** PATCH { id, status } - manually mark paid/failed after verifier confirmation. */
export const PATCH = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "ACCOUNTANT");
  const body = await req.json().catch(() => ({}));
  const id = parseInt(body.id, 10);
  const status = String(body.status || "");
  if (!Number.isInteger(id) || !["Paid", "Failed", "Pending"].includes(status)) {
    return Response.json({ error: "id and a valid status (Paid|Failed|Pending) are required" }, { status: 400 });
  }
  const { rows } = await query(
    `UPDATE momo_transaction SET status = $1, paid_at = CASE WHEN $1 = 'Paid' THEN now() ELSE paid_at END
      WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });

  // Apply the payment to the underlying register row.
  const t = rows[0];
  if (status === "Paid") {
    const map = {
      BOOKING: ["booking", "amount_paid"],
      PARCEL: ["parcel", "amount_paid"],
      PRIVATE_HIRE: ["private_hire", "amount_paid"],
      SCHOOL: ["school_student", "amount_paid"],
    };
    const m = map[t.subject_type];
    if (m) {
      await query(`UPDATE ${m[0]} SET ${m[1]} = ${m[1]} + $1 WHERE id = $2`, [t.amount, t.subject_id]);
    }
  }
  return Response.json({ data: rows[0] });
});