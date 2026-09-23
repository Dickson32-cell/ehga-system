/**
 * Private-hire auto-quote: distance + fuel economy + vehicle rate.
 *
 * The estimate is fuel-aware: the trip's kilometres are priced through the car's
 * consumption (km per litre) and the current fuel price, so the quote never
 * prices a trip below what the fuel alone will cost. Per the diagram:
 * "Private-hire auto-quote, MD approves" — distance × fuel economics + rate.
 *
 * Setup keys (editable by MD/OM in Setup):
 *   route_km              "Koforidua to Accra:90|Accra to Koforidua:90|..."
 *   hire_base_fare        base charge before distance (default 50)
 *   avg_speed_kph         for the duration line (default 60)
 *   fuel_price_per_litre  pump price used in the estimate (default 17)
 *   km_per_litre          fleet default consumption (default 12 km/L)
 * Per-car override: vehicle.km_per_litre (editable in Fleet by MD/OM).
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

function routeKmValue(map, key) {
  return map[key];
}

export async function quoteParams() {
  const { rows } = await query("SELECT key, value FROM setup_kv");
  const kv = {};
  for (const r of rows) kv[r.key] = r.value;
  return {
    routeKm: parseKvMap(kv.route_km || ""),
    base: Number(kv.hire_base_fare || 50),
    avgKph: Number(kv.avg_speed_kph || 60) || 60,
    fuelPrice: Number(kv.fuel_price_per_litre || 17) || 17,
    defaultKmPerLitre: Number(kv.km_per_litre || 12) || 12,
  };
}

/** Returns { km, hours, base, vehicleRate, kmPerLitre, fuelPrice, litres, fuelCost, estimate, breakdown } */
export async function autoQuote({ direction, vehicleCode, pickup, destination }) {
  const p = await quoteParams();

  // Resolve trip km: (1) exact direction key, (2) pickup+destination matched
  // against route_km entries (either order, substring match), (3) 25km default.
  let km = Number(p.routeKm[direction]);
  let kmSource = km > 0 ? "route" : null;
  if (!(km > 0) && pickup && destination) {
    const pu = pickup.toLowerCase();
    const de = destination.toLowerCase();
    for (const [route, val] of Object.entries(p.routeKm)) {
      const r = route.toLowerCase();
      const parts = r.split(/\s+to\s+/);
      if (
        (r.includes(pu) && r.includes(de)) ||
        (parts.length === 2 && pu.includes(parts[0]) && de.includes(parts[1])) ||
        (parts.length === 2 && de.includes(parts[0]) && pu.includes(parts[1]))
      ) {
        km = Number(routeKmValue(p.routeKm, route));
        kmSource = "route-match";
        break;
      }
    }
  }
  if (!(km > 0)) {
    km = 25; // conservative default for custom routes
    kmSource = "estimate";
  }
  const hours = km / p.avgKph;

  // Per-car consumption: Fleet override, else the fleet default from Setup.
  let kmPerLitre = p.defaultKmPerLitre;
  let vehicleRate = 0;
  if (vehicleCode) {
    const { rows } = await query(
      "SELECT COALESCE(rate_per_km, 0)::float8 r, COALESCE(km_per_litre, 0)::float8 k FROM vehicle WHERE vehicle_code = $1 AND deleted = FALSE",
      [vehicleCode]
    );
    vehicleRate = rows[0]?.r || 0;
    if (rows[0]?.k > 0) kmPerLitre = rows[0].k;
  }

  // Fuel economics: litres the trip burns × pump price.
  const litres = km / kmPerLitre;
  const fuelCost = litres * p.fuelPrice;

  const base = p.base;
  const raw = base + km * vehicleRate + fuelCost;
  const estimate = Math.max(Math.round(raw * 2) / 2, Math.round((base + fuelCost) * 2) / 2); // nearest GHS 0.50, never below base + fuel

  return {
    km: Number(km.toFixed(1)),
    hours: Number(hours.toFixed(2)),
    base,
    vehicleRate,
    kmPerLitre,
    fuelPrice: p.fuelPrice,
    litres: Number(litres.toFixed(2)),
    fuelCost: Number(fuelCost.toFixed(2)),
    estimate: Number(estimate.toFixed(2)),
    breakdown: [
      `Base charge GHS ${base.toFixed(2)}`,
      km * vehicleRate > 0 ? `Distance ${km.toFixed(1)} km × GHS ${vehicleRate}/km = GHS ${(km * vehicleRate).toFixed(2)}` : null,
      `Fuel ${litres.toFixed(2)} L (${km.toFixed(1)} km ÷ ${kmPerLitre} km/L) × GHS ${p.fuelPrice.toFixed(2)}/L = GHS ${fuelCost.toFixed(2)}`,
    ].filter(Boolean),
  };
}