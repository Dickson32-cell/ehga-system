import { REGISTERS } from "@/lib/registers";
import { requireSession, requireRole, apiHandler } from "@/lib/auth";
import { query, tx } from "@/lib/db";
import { sendPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reg(name) {
  const r = REGISTERS[name];
  if (!r) {
    const err = new Error("Unknown register: " + name);
    err.status = 404;
    throw err;
  }
  return r;
}

/** vehicle table is keyed by vehicle_code, everything else by serial id. */
function idColOf(regDef) {
  return regDef.table === "vehicle" ? "vehicle_code" : "id";
}

async function kvLists(client) {
  const { rows } = await client.query("SELECT key, value FROM setup_kv");
  const map = {};
  for (const row of rows) map[row.key] = row.value.split("|");
  return map;
}

function validateFields(regDef, body, kvs) {
  const out = {};
  const errors = [];
  for (const f of regDef.fields) {
    if (!Object.prototype.hasOwnProperty.call(body, f.name)) continue;
    let v = body[f.name];
    if (v === "" || v === null || v === undefined) {
      continue; // PATCH omits empty optional fields
    }
    switch (f.type) {
      case "number":
        v = Number(v);
        if (!isFinite(v)) errors.push(f.name + " must be a number");
        break;
      case "int":
        v = parseInt(v, 10);
        if (!Number.isInteger(v)) errors.push(f.name + " must be an integer");
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errors.push(f.name + " must be YYYY-MM-DD");
        break;
      case "time":
        if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(v))) errors.push(f.name + " must be HH:MM");
        break;
      case "bool":
        v = v === true || v === "true" || v === 1 || v === "1";
        break;
      case "select": {
        v = String(v);
        const allowed = f.options || (f.kv && kvs[f.kv]) || [];
        if (allowed.length && !allowed.includes(v)) {
          errors.push(f.name + " must be one of: " + allowed.join(", "));
        }
        break;
      }
      default:
        v = String(v);
    }
    out[f.name] = v;
  }
  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }
  return out;
}

async function fuelRecompute(client, row) {
  if (!row.odometer) return;
  const prev = await client.query(
    "SELECT odometer FROM fuel WHERE vehicle_id = $1 AND deleted = FALSE AND id <> $2 AND odometer <= $3 ORDER BY date DESC, id DESC LIMIT 1",
    [row.vehicle_id, row.id, row.odometer]
  );
  const km = prev.rows.length ? Math.max(Number(row.odometer) - Number(prev.rows[0].odometer), 0) : 0;
  await client.query("UPDATE fuel SET km_since_prior_fuel = $1 WHERE id = $2", [km, row.id]);
}

export const GET = apiHandler(async (req, ctx) => {
  const { register, id } = await ctx.params;
  const regDef = reg(register);
  await requireSession();
  const { rows } = await query(`SELECT * FROM ${regDef.table} WHERE ${idColOf(regDef)} = $1 AND deleted = FALSE`, [id]);
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: rows[0] });
});

export const PATCH = apiHandler(async (req, ctx) => {
  const { register, id } = await ctx.params;
  const regDef = reg(register);
  await requireRole(...regDef.roles.write);
  const body = await req.json().catch(() => ({}));

  const result = await tx(async (client) => {
    const existing = await client.query(
      `SELECT * FROM ${regDef.table} WHERE ${idColOf(regDef)} = $1 AND deleted = FALSE`,
      [id]
    );
    if (!existing.rows.length) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    const kvs = await kvLists(client);
    const values = validateFields(regDef, body, kvs);

    if (values.vehicle_id) {
      const v = await client.query("SELECT 1 FROM vehicle WHERE vehicle_code = $1", [values.vehicle_id]);
      if (!v.rows.length) {
        const err = new Error("Unknown vehicle_code: " + values.vehicle_id);
        err.status = 400;
        throw err;
      }
    }

    const cols = Object.keys(values);
    let row = existing.rows[0];
    if (cols.length) {
      const sets = cols.map((c, i) => `"${c}" = $${i + 2}`);
      const idCol = idColOf(regDef);
      const sql = `UPDATE ${regDef.table} SET ${sets.join(", ")} WHERE ${idCol} = $1 RETURNING *`;
      const { rows } = await client.query(sql, [id, ...cols.map((c) => values[c])]);
      row = rows[0];
    }
    if (regDef.table === "fuel") {
      await fuelRecompute(client, row);
      const refreshed = await client.query("SELECT * FROM fuel WHERE id = $1", [row.id]);
      row = refreshed.rows[0];
    }
    return row;
  });

  // Fire-and-forget push alerts (never block or fail the save).
  notifyRegisterChange(regDef.table, result, body).catch(() => {});

  return Response.json({ data: result });
});

/**
 * Push notifications on meaningful register changes. Best-effort: a failed
 * push never blocks the operation itself.
 */
async function notifyRegisterChange(table, row, body) {
  if (!row) return;
  const code = row.booking_code || row.parcel_code || row.dispatch_code || row.hire_code || row.student_code || "";

  if (table === "booking" && body.status) {
    if (row.customer_id && body.status !== "Pending") {
      await sendPush("customer", row.customer_id, {
        title: `Booking ${code}: ${body.status}`,
        body:
          body.status === "Confirmed"
            ? "Your seat is confirmed. See you at the pickup point."
            : body.status === "Boarded"
              ? "You are marked as boarded — have a safe trip."
              : body.status === "Completed"
                ? "Trip completed. Thank you for riding with EHGA."
                : `Your booking is now ${body.status}.`,
        url: "/portal/dashboard",
      });
    }
  }

  if (table === "parcel" && body.status && row.customer_id) {
    await sendPush("customer", row.customer_id, {
      title: `Parcel ${code}: ${body.status}`,
      body: `Your parcel status is now ${body.status}.`,
      url: "/portal/track",
    });
  }

  if (table === "dispatch" && body.decision === "Go" && row.vehicle_id) {
    const v = await query(
      "SELECT assigned_driver FROM vehicle WHERE vehicle_code = $1",
      [row.vehicle_code || row.vehicle_id]
    );
    const driver = v.rows[0]?.assigned_driver;
    if (driver) {
      const u = await query(
        "SELECT id FROM app_user WHERE full_name = $1 AND active = TRUE",
        [driver]
      );
      if (u.rows[0]) {
        await sendPush("staff", u.rows[0].id, {
          title: `Dispatch ${code}: GO`,
          body: `You are on the ${row.direction || ""} run today. Check My Job for details.`,
          url: "/app/my-job",
        });
      }
    }
  }

  if (table === "incident" && body.severity === "Severe") {
    const mds = await query("SELECT id FROM app_user WHERE role = 'MANAGING_DIRECTOR' AND active = TRUE");
    for (const md of mds.rows) {
      await sendPush("staff", md.id, {
        title: "Severe incident reported",
        body: row.incident_code ? `Incident ${row.incident_code} needs your review.` : "A severe incident was reported.",
        url: "/app/incidents",
      });
    }
  }
}

/** Soft delete: row stays in DB (audit trail) but disappears from all lists. */
export const DELETE = apiHandler(async (req, ctx) => {
  const { register, id } = await ctx.params;
  const regDef = reg(register);
  await requireRole(...regDef.roles.write);
  const idCol = idColOf(regDef);
  const retCol = regDef.table === "vehicle" ? "vehicle_code" : "id";
  const { rows } = await query(
    `UPDATE ${regDef.table} SET deleted = TRUE WHERE ${idCol} = $1 AND deleted = FALSE RETURNING ${retCol}`,
    [id]
  );
  if (!rows.length) return Response.json({ error: "Not found or already deleted" }, { status: 404 });
  return Response.json({ ok: true, id: rows[0][retCol] });
});
