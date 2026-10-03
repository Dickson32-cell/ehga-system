import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/drivers/decision { id, decision: "approve" | "decline", note? }
 * MANAGING_DIRECTOR or HR only. On approve: creates the staff account
 * (DRIVER role, must_change_password=TRUE) and marks the application approved.
 * On decline: keeps the row flagged declined (audit + prevents re-apply).
 */

function makeUsername(fullName, id) {
  const parts = String(fullName).trim().split(/\s+/);
  const first = parts[0] || "driver";
  const last = parts[parts.length - 1] || "";
  const base = (first[0] + last).toLowerCase().replace(/[^a-z0-9]/g, "");
  return (base || "driver") + ".ehga" + (base ? id : String(id)); // uniqueness by application id
}

export const POST = apiHandler(async (req) => {
  const me = await requireRole("MANAGING_DIRECTOR", "HR");
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  const decision = String(b.decision || "");
  const note = String(b.note || "").trim().slice(0, 500) || null;
  if (!id || !["approve", "decline"].includes(decision)) {
    return Response.json({ error: "Send { id, decision }" }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, full_name, phone, password_hash, status,
            vehicle_reg_no, vehicle_make, vehicle_color,
            license_expiry, insurance_expiry, roadworthy_expiry
       FROM driver_application WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return Response.json({ error: "Application not found" }, { status: 404 });
  if (rows[0].status !== "pending") {
    return Response.json({ error: `Already ${rows[0].status}` }, { status: 409 });
  }

  if (decision === "decline") {
    await query(
      `UPDATE driver_application
         SET status = 'declined', reviewed_by = $2, reviewed_at = now(), review_note = $3
       WHERE id = $1`,
      [id, me.sub, note]
    );
    return Response.json({ ok: true, status: "declined" });
  }

  // approve -> staff account
  const app = rows[0];
  const username = makeUsername(app.full_name, app.id);
  const dupU = await query("SELECT 1 FROM app_user WHERE username = $1", [username]);
  const finalUsername = dupU.rows.length ? username + Math.floor(Math.random() * 90 + 10) : username;

  const { rows: newUser } = await query(
    `INSERT INTO app_user (username, full_name, role, password_hash, active, must_change_password)
     VALUES ($1,$2,'DRIVER',$3,TRUE,TRUE)
     RETURNING id, username`,
    [finalUsername, app.full_name, app.password_hash]
  );

  // Reuse the existing vehicle if its registration already exists (approved car in fleet);
  // otherwise insert it from the application data.
  const dupV = await query("SELECT vehicle_code FROM vehicle WHERE registration = $1", [app.vehicle_reg_no]);
  if (!dupV.rows.length) {
    const vc = "VH-D" + String(app.id).padStart(3, "0");
    await query(
      `INSERT INTO vehicle (vehicle_code, type, primary_role, registration, model, color,
                            assigned_driver, insurance_expiry, roadworthy_expiry, status)
       VALUES ($1,'saloon','DRIVER',$2,$3,$4,$5,$6,$7,'Available')`,
      [vc, app.vehicle_reg_no, app.vehicle_make, app.vehicle_color, finalUsername,
       app.insurance_expiry, app.roadworthy_expiry]
    );
  }

  await query(
    `UPDATE driver_application
       SET status = 'approved', reviewed_by = $2, reviewed_at = now(), review_note = $3
     WHERE id = $1`,
    [id, me.sub, note]
  );

  return Response.json({ ok: true, status: "approved", username: finalUsername });
});
