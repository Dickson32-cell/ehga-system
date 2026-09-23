import { apiHandler, requireRole } from "@/lib/auth";
import { query, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dispatch/signoff?dispatch_id=N - sign-off state for a dispatch row. */
export const GET = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER");
  const url = new URL(req.url);
  const dispatchId = parseInt(url.searchParams.get("dispatch_id"), 10);
  if (!Number.isInteger(dispatchId)) {
    return Response.json({ error: "dispatch_id is required" }, { status: 400 });
  }
  const { rows } = await query(
    "SELECT * FROM departure_signoff WHERE dispatch_id = $1 AND deleted = FALSE",
    [dispatchId]
  );
  return Response.json({ data: rows[0] || null });
});

/**
 * POST { dispatch_id, checks: "bookings_confirmed,payments_received,manifest_printed,gps_on",
 *        gps_ok } - driver (or dispatcher on the driver's behalf) signs BEFORE
 * departure. One sign-off per dispatch row.
 */
export const POST = apiHandler(async (req) => {
  const session = await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER");
  const body = await req.json().catch(() => ({}));
  const dispatchId = parseInt(body.dispatch_id, 10);
  if (!Number.isInteger(dispatchId)) {
    return Response.json({ error: "dispatch_id is required" }, { status: 400 });
  }

  const checks = Array.isArray(body.checks)
    ? body.checks.map(String).slice(0, 20).join(",")
    : String(body.checks || "").slice(0, 300);
  if (!checks) {
    return Response.json({ error: "Tick at least one pre-departure check" }, { status: 400 });
  }

  const result = await tx(async (client) => {
    const d = await client.query("SELECT id FROM dispatch WHERE id = $1 AND deleted = FALSE", [dispatchId]);
    if (!d.rows.length) {
      const err = new Error("Dispatch row not found");
      err.status = 404;
      throw err;
    }
    const existing = await client.query(
      "SELECT id FROM departure_signoff WHERE dispatch_id = $1 AND deleted = FALSE",
      [dispatchId]
    );
    if (existing.rows.length) {
      const { rows } = await client.query(
        `UPDATE departure_signoff SET signed_by = $1, role = $2, checks = $3, gps_ok = $4, signed_at = now()
          WHERE id = $5 RETURNING *`,
        [session.full_name || session.username, session.role, checks, body.gps_ok === true, existing.rows[0].id]
      );
      return rows[0];
    }
    const { rows } = await client.query(
      `INSERT INTO departure_signoff(dispatch_id, signed_by, role, checks, gps_ok)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [dispatchId, session.full_name || session.username, session.role, checks, body.gps_ok === true]
    );
    return rows[0];
  });

  return Response.json({ data: result, message: "Departure signed off" }, { status: 201 });
});