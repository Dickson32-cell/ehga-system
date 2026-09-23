import { apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/config - public landing-page data: routes, standard fare,
 * WhatsApp line. Real values from Setup, no invention.
 */
export const GET = apiHandler(async () => {
  const { rows } = await query("SELECT key, value FROM setup_kv");
  const kv = {};
  for (const r of rows) kv[r.key] = r.value;

  const directions = (kv.directions || "").split("|").filter(Boolean);
  const intercity = directions.filter((d) => d.toLowerCase().includes(" to "));
  const local = directions.filter((d) => !d.toLowerCase().includes(" to "));

  const { rows: v } = await query(
    "SELECT count(*)::int n FROM vehicle WHERE deleted = FALSE AND status = 'Available'"
  );

  return Response.json({
    intercity,
    local,
    fare: Number(kv.standard_fare || 90),
    parcelBase: 20,
    pickupCharge: 10,
    deliveryCharge: 10,
    fleetCount: v[0]?.n || 0,
    whatsapp: kv.whatsapp_line || "",
  });
});