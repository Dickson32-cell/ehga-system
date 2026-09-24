import { REGISTERS } from "@/lib/registers";
import { requireSession, requireRole, apiHandler } from "@/lib/auth";
import { query, tx } from "@/lib/db";
import { sendPushToRoles } from "@/lib/push";

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

async function kvLists(client) {
  const { rows } = await client.query("SELECT key, value FROM setup_kv");
  const map = {};
  for (const row of rows) map[row.key] = row.value.split("|");
  return map;
}

function validateFields(regDef, body, { partial }, kvs) {
  const out = {};
  const errors = [];
  for (const f of regDef.fields) {
    const provided = Object.prototype.hasOwnProperty.call(body, f.name);
    if (!provided) {
      if (!partial && f.required && (f.def === undefined || f.def === null)) {
        errors.push(f.name + " is required");
      }
      continue;
    }
    let v = body[f.name];
    if (v === "" || v === null || v === undefined) {
      if (f.required) errors.push(f.name + " is required");
      continue; // omit empty optional fields
    }
    switch (f.type) {
      case "number": {
        v = Number(v);
        if (!isFinite(v)) errors.push(f.name + " must be a number");
        break;
      }
      case "int": {
        v = parseInt(v, 10);
        if (!Number.isInteger(v)) errors.push(f.name + " must be an integer");
        break;
      }
      case "date": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errors.push(f.name + " must be YYYY-MM-DD");
        break;
      }
      case "time": {
        if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(v))) errors.push(f.name + " must be HH:MM");
        break;
      }
      case "bool": {
        v = v === true || v === "true" || v === 1 || v === "1";
        break;
      }
      case "select": {
        v = String(v);
        const allowed = f.options || (f.kv && kvs[f.kv]) || [];
        if (allowed.length && !allowed.includes(v)) {
          errors.push(f.name + ' must be one of: ' + allowed.join(", "));
        }
        break;
      }
      case "vehicle": {
        v = String(v);
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

async function applyDefaults(regDef, values) {
  for (const f of regDef.fields) {
    if (!(f.name in values) && f.def !== undefined && f.def !== null) {
      values[f.name] = f.def;
    }
  }
  return values;
}

/** Fuel: compute km_since_prior_fuel from the previous fuel log for the vehicle. */
async function fuelExtras(client, values) {
  if (!values.odometer) return values;
  const prev = await client.query(
    "SELECT odometer FROM fuel WHERE vehicle_id = $1 AND deleted = FALSE AND odometer <= $2 ORDER BY date DESC, id DESC LIMIT 1",
    [values.vehicle_id, values.odometer]
  );
  if (prev.rows.length) {
    values.km_since_prior_fuel = Math.max(Number(values.odometer) - Number(prev.rows[0].odometer), 0);
  }
  return values;
}

/** School: auto-generate unique 6-char pickup code. */
function randomPickupCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export const GET = apiHandler(async (req, ctx) => {
  const { register } = await ctx.params;
  const regDef = reg(register);
  await requireSession();
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "500", 10), 1000);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const dateCol = regDef.table === "cash_reconciliation" ? "date" : regDef.fields.find((f) => f.type === "date")?.name;

  const where = ["deleted = FALSE"];
  const params = [];
  if (from && dateCol) {
    params.push(from);
    where.push(`${dateCol} >= $${params.length}`);
  }
  if (to && dateCol) {
    params.push(to);
    where.push(`${dateCol} <= $${params.length}`);
  }
  const idCol = regDef.codeColumn === "vehicle_code" ? "vehicle_code" : "id";
  const sql =
    `SELECT * FROM ${regDef.table} WHERE ${where.join(" AND ")}` +
    ` ORDER BY ${dateCol || idCol} DESC, ${idCol} DESC LIMIT ${limit}`;
  const { rows } = await query(sql, params);
  return Response.json({ data: rows, count: rows.length });
});

export const POST = apiHandler(async (req, ctx) => {
  const { register } = await ctx.params;
  const regDef = reg(register);
  const session = await requireRole(...regDef.roles.write);
  const body = await req.json().catch(() => ({}));

  const result = await tx(async (client) => {
    const kvs = await kvLists(client);
    let values = validateFields(regDef, body, { partial: false }, kvs);
    await applyDefaults(regDef, values);

    if (regDef.table === "fuel") {
      values = await fuelExtras(client, values);
    }
    if (regDef.table === "school_student") {
      let tries = 0;
      while (tries < 5) {
        const exists = await client.query("SELECT 1 FROM school_student WHERE pickup_code = $1", [
          randomPickupCode(),
        ]);
        if (!exists.rows.length) break;
        tries++;
      }
    }

    // vehicle existence check
    if (values.vehicle_id) {
      const v = await client.query("SELECT 1 FROM vehicle WHERE vehicle_code = $1", [values.vehicle_id]);
      if (!v.rows.length) {
        const err = new Error("Unknown vehicle_code: " + values.vehicle_id);
        err.status = 400;
        throw err;
      }
    }

    const cols = Object.keys(values);
    if (!cols.length) {
      const err = new Error("No valid fields provided");
      err.status = 400;
      throw err;
    }
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const sql = `INSERT INTO ${regDef.table} (${cols.map((c) => '"' + c + '"').join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`;
    const { rows } = await client.query(sql, cols.map((c) => values[c]));
    return rows[0];
  });

  // Staff alerts for new customer-facing work. Fire-and-forget.
  notifyNewRow(regDef.table, result).catch(() => {});

  return Response.json({ data: result }, { status: 201 });
});

/**
 * Push alerts to the office when a new customer order/row arrives.
 * Operations + Dispatch act on them; the CEO sees everything.
 */
async function notifyNewRow(table, row) {
  if (!row) return;
  const roles = ["OPERATIONS_MANAGER", "DISPATCHER", "MANAGING_DIRECTOR"];
  if (table === "booking") {
    await sendPushToRoles(roles, {
      title: `New booking ${row.booking_code}`,
      body: `${row.direction || "Route TBA"} on ${row.travel_date ? String(row.travel_date).slice(0, 10) : "TBA"} — needs a Go decision.`,
      url: "/app/bookings",
    });
  } else if (table === "parcel") {
    await sendPushToRoles(roles, {
      title: `New parcel ${row.parcel_code}`,
      body: "A parcel booking was recorded and is awaiting pickup.",
      url: "/app/parcels",
    });
  } else if (table === "private_hire") {
    await sendPushToRoles(roles, {
      title: `Private hire request ${row.hire_code || ""}`.trim(),
      body: `${row.pickup || ""} to ${row.destination || ""} — quote and assign a car.`,
      url: "/app/private-hire",
    });
  } else if (table === "school_student") {
    await sendPushToRoles(roles, {
      title: `New school run ${row.student_code || ""}`.trim(),
      body: "A new school transport registration was recorded.",
      url: "/app/school",
    });
  } else if (table === "incident") {
    await sendPushToRoles(["MANAGING_DIRECTOR", "OPERATIONS_MANAGER"], {
      title: `Incident ${row.incident_code || ""} reported`.trim(),
      body: `${row.type || "Incident"} — severity ${row.severity || "TBA"}.`,
      url: "/app/incidents",
    });
  }
}
