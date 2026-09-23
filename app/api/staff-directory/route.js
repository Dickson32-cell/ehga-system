import { requireSession, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/staff-directory — active DRIVERS and RIDERS only (full names).
 * For any signed-in staff member: registers (e.g. Fleet) need the field-staff
 * dropdown, and assigning vehicles is an Operations Manager duty — so this
 * list is NOT limited to MD/HR like /api/staff. Exposes nothing sensitive:
 * just the full names and roles of field staff.
 */
export const GET = apiHandler(async () => {
  await requireSession();
  const { rows } = await query(
    `SELECT full_name, role FROM app_user
      WHERE role IN ('DRIVER', 'RIDER') AND active = TRUE
      ORDER BY full_name`
  );
  return Response.json({ data: rows });
});