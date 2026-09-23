import { requireRole, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireRole(
    "MANAGING_DIRECTOR",
    "OPERATIONS_MANAGER",
    "DISPATCHER",
    "ACCOUNTANT",
    "DRIVER",
    "RIDER"
  );
  const { rows } = await query("SELECT key, value, updated_at FROM setup_kv ORDER BY key");
  return Response.json({ data: rows });
});

/** PUT { key: value, ... } - MANAGING_DIRECTOR and OPERATIONS_MANAGER only. */
export const PUT = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER");
  const body = await req.json().catch(() => ({}));
  const entries = Object.entries(body).filter(([k, v]) => k && v !== undefined && v !== null);
  if (!entries.length) return Response.json({ error: "No keys provided" }, { status: 400 });
  for (const [k, v] of entries) {
    await query(
      "INSERT INTO setup_kv(key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()",
      [String(k), String(v)]
    );
  }
  const { rows } = await query("SELECT key, value, updated_at FROM setup_kv ORDER BY key");
  return Response.json({ data: rows });
});
