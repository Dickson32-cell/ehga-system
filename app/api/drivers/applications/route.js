import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/drivers/applications?status=pending — CEO/HR review feed.
 * Returns the documents (base64) so the reviewer can inspect the licence/card/vehicle.
 */
export const GET = apiHandler(async () => {
  await requireRole("MANAGING_DIRECTOR", "HR");
  const { rows } = await query(
    `SELECT id, full_name, phone, email, license_no, license_expiry,
            ghana_card_no, ghana_card_image, vehicle_reg_no, vehicle_make, vehicle_color,
            vehicle_images, insurance_expiry, roadworthy_expiry, status, review_note,
            reviewed_at, created_at
       FROM driver_application
      ORDER BY (status = 'pending') DESC, created_at DESC
      LIMIT 200`
  );
  return Response.json({ applications: rows });
});
