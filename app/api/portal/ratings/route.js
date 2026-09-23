import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET - the customer's own ratings. */
export const GET = apiHandler(async () => {
  const session = await requireCustomer();
  const { rows } = await query(
    "SELECT id, subject_type, subject_id, rating, comment, created_at FROM trip_rating WHERE by_customer_id = $1 ORDER BY created_at DESC LIMIT 100",
    [session.id]
  );
  return Response.json({ data: rows });
});

/**
 * POST { subject_type: BOOKING|PARCEL|PRIVATE_HIRE|SCHOOL, code, rating, comment }
 * The code (EL-B-0007 etc.) is verified to belong to THIS customer before the
 * rating is accepted - a customer cannot rate someone else's trip.
 */
export const POST = apiHandler(async (req) => {
  const session = await requireCustomer();
  const body = await req.json().catch(() => ({}));

  const subjectType = String(body.subject_type || "");
  const code = String(body.code || "").trim();
  const rating = parseInt(body.rating, 10);

  const TABLES = {
    BOOKING: { table: "booking", codeCol: "booking_code", label: "booking" },
    PARCEL: { table: "parcel", codeCol: "parcel_code", label: "parcel" },
    PRIVATE_HIRE: { table: "private_hire", codeCol: "hire_code", label: "private hire" },
    SCHOOL: { table: "school_student", codeCol: "student_code", label: "school run" },
  };
  const t = TABLES[subjectType];
  if (!t) return Response.json({ error: "Unknown rating type" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Rating must be 1 to 5 stars" }, { status: 400 });
  }

  const owner = await query(
    `SELECT id FROM ${t.table} WHERE ${t.codeCol} = $1 AND customer_id = $2 AND deleted = FALSE`,
    [code, session.id]
  );
  if (!owner.rows.length) {
    return Response.json({ error: "No " + t.label + " with that code on your account" }, { status: 404 });
  }

  const result = await tx(async (client) => {
    const existing = await client.query(
      "SELECT id FROM trip_rating WHERE subject_type = $1 AND subject_id = $2 AND by_customer_id = $3",
      [subjectType, owner.rows[0].id, session.id]
    );
    if (existing.rows.length) {
      const { rows } = await client.query(
        "UPDATE trip_rating SET rating = $1, comment = $2, created_at = now() WHERE id = $3 RETURNING *",
        [rating, String(body.comment || "").trim() || null, existing.rows[0].id]
      );
      return rows[0];
    }
    const { rows } = await client.query(
      "INSERT INTO trip_rating(subject_type, subject_id, rating, comment, by_customer_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [subjectType, owner.rows[0].id, rating, String(body.comment || "").trim() || null, session.id]
    );
    return rows[0];
  });

  return Response.json({ data: result, message: "Thank you for your feedback!" }, { status: 201 });
});