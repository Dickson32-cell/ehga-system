import { REGISTERS } from "@/lib/registers";
import { requireSession, requireRole, apiHandler } from "@/lib/auth";
import { query, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Incident register: any staff can report; MD/Ops manage status closure.
const WRITE_ALL = ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER", "ACCOUNTANT", "DRIVER", "RIDER"];
const MANAGE = ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER"];

const TYPES = ["Accident", "Breakdown", "Tyre", "Engine", "Delay", "Customer complaint", "Cargo damage", "Other"];
const SEVERITIES = ["Minor", "Moderate", "Severe"];
const STATUSES = ["Open", "Investigating", "Closed"];

function validate(body, { partial }) {
  const out = {};
  const errors = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has("date")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ""))) errors.push("date is required (YYYY-MM-DD)");
    else out.date = body.date;
  }
  if (!partial || has("type")) {
    const t = String(body.type || "Other");
    if (!TYPES.includes(t)) errors.push("type must be one of: " + TYPES.join(", "));
    else out.type = t;
  }
  if (!partial || has("severity")) {
    const s = String(body.severity || "Minor");
    if (!SEVERITIES.includes(s)) errors.push("severity must be one of: " + SEVERITIES.join(", "));
    else out.severity = s;
  }
  if (!partial || has("status")) {
    const s = String(body.status || "Open");
    if (!STATUSES.includes(s)) errors.push("status must be one of: " + STATUSES.join(", "));
    else out.status = s;
  }
  for (const k of ["description", "action_taken", "vehicle_id", "reported_by"]) {
    if (has(k)) out[k] = body[k] === "" || body[k] === null ? null : String(body[k]);
  }
  if (has("trip_id")) {
    const n = parseInt(body.trip_id, 10);
    out.trip_id = Number.isInteger(n) ? n : null;
  }
  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }
  return out;
}

export const GET = apiHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const params = [];
  let where = "deleted = FALSE";
  if (status && STATUSES.includes(status)) {
    params.push(status);
    where += " AND status = $" + params.length;
  }
  const { rows } = await query(
    `SELECT i.*, v.vehicle_code AS vehicle_label FROM incident i
      LEFT JOIN vehicle v ON v.vehicle_code = i.vehicle_id
      WHERE i.${where} ORDER BY i.date DESC, i.id DESC LIMIT 300`,
    params
  );
  return Response.json({ data: rows });
});

export const POST = apiHandler(async (req) => {
  await requireRole(...WRITE_ALL);
  const body = await req.json().catch(() => ({}));
  const values = validate(body, { partial: false });
  if (!values.reported_by) values.reported_by = "(staff)";
  const cols = Object.keys(values);
  const { rows } = await query(
    `INSERT INTO incident(${cols.map((c) => '"' + c + '"').join(",")})
     VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
    cols.map((c) => values[c])
  );
  return Response.json({ data: rows[0] }, { status: 201 });
});

export const PATCH = apiHandler(async (req) => {
  await requireRole(...MANAGE);
  const body = await req.json().catch(() => ({}));
  const id = parseInt(body.id, 10);
  if (!Number.isInteger(id)) return Response.json({ error: "id is required" }, { status: 400 });
  const values = validate(body, { partial: true });
  const cols = Object.keys(values);
  if (!cols.length) return Response.json({ error: "Nothing to update" }, { status: 400 });
  const sets = cols.map((c, i) => `"${c}" = $${i + 2}`);
  const { rows } = await query(
    `UPDATE incident SET ${sets.join(", ")} WHERE id = $1 AND deleted = FALSE RETURNING *`,
    [id, ...cols.map((c) => values[c])]
  );
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: rows[0] });
});