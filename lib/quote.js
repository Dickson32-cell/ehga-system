/**
 * Private-hire auto-quote: distance + vehicle rate, per the diagram
 * ("Private-hire auto-quote, MD approves" / "distance plus vehicle rate").
 * Route distances come from setup_kv `route_km` (editable in Setup by MD/Ops),
 * falling back to a conservative default for custom pickup/destination.
 */
import { query } from "./db";

function parseKvMap(value) {
  // "Koforidua to Accra:90|Accra to Koforidua:90" -> {..}
  const out = {};
  for (const part of String(value || "").split("|")) {
    const idx = part.lastIndexOf(":");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

export async function quoteParams() {
  const { rows } = await query("SELECT key, value FROM setup_kv");
  const kv = {};
  for (const r of rows) kv[r.key] = r.value;
  return {
    routeKm: parseKvMap(kv.route_km || ""),
    base: Number(kv.hire_base_fare || 50),
    avgKph: Number(kv.avg_speed_kph || 60) || 60,
  };
}

/** Returns { km, hours, base, vehicleRate, estimate } for an auto-quote. */
export async function autoQuote({ direction, vehicleCode }) {
  const p = await quoteParams();
  let km = Number(p.routeKm[direction]);
  if (!isFinite(km) || km <= 0) km = 25; // conservative default for custom routes
  const hours = km / p.avgKph;

  let vehicleRate = 0;
  if (vehicleCode) {
    const { rows } = await query(
      "SELECT COALESCE(rate_per_km, 0)::float8 r FROM vehicle WHERE vehicle_code = $1 AND deleted = FALSE",
      [vehicleCode]
    );
    vehicleRate = rows[0]?.r || 0;
  }

  const base = p.base;
  const raw = base + km * vehicleRate;
  const estimate = Math.max(Math.round(raw * 2) / 2, base); // nearest GHS 0.50, never below base
  return {
    km: Number(km.toFixed(1)),
    hours: Number(hours.toFixed(2)),
    base,
    vehicleRate,
    estimate: Number(estimate.toFixed(2)),
  };
}