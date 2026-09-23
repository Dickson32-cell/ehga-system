import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATEWAY = process.env.PAYSTACK_SECRET_KEY ? "paystack" : process.env.HUBTEL_CLIENT_ID ? "hubtel" : null;

/**
 * POST /api/portal/momo/initiate { subject_type, code } - customer pays a
 * balance via MoMo inside the app. Creates a momo_transaction and, when a
 * gateway key is configured, initialises a Paystack transaction and returns
 * the authorization_url. Without keys the request is queued as Pending so
 * staff can take payment in person (SMS/WhatsApp fallback).
 */
export const POST = apiHandler(async (req) => {
  const session = await requireCustomer();
  const body = await req.json().catch(() => ({}));

  const subjectType = String(body.subject_type || "");
  const code = String(body.code || "").trim();
  const TABLES = {
    BOOKING: { table: "booking", codeCol: "booking_code", label: "booking" },
    PARCEL: { table: "parcel", codeCol: "parcel_code", label: "parcel" },
    PRIVATE_HIRE: { table: "private_hire", codeCol: "hire_code", label: "private hire" },
    SCHOOL: { table: "school_student", codeCol: "student_code", label: "school run" },
  };
  const t = TABLES[subjectType];
  if (!t) return Response.json({ error: "Unknown payment type" }, { status: 400 });

  const { rows: own } = await query(
    `SELECT id, balance FROM ${t.table} WHERE ${t.codeCol} = $1 AND customer_id = $2 AND deleted = FALSE`,
    [code, session.id]
  );
  if (!own.length) {
    return Response.json({ error: "No " + t.label + " with that code on your account" }, { status: 404 });
  }
  const amount = Number(own[0].balance);
  if (!(amount > 0)) {
    return Response.json({ error: "Nothing left to pay on this " + t.label }, { status: 400 });
  }

  const reference = `EHGA-${subjectType.slice(0, 3)}-${own[0].id}-${Date.now().toString(36).toUpperCase()}`;

  const result = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO momo_transaction(reference, provider, subject_type, subject_id, customer_id, amount, phone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending') RETURNING *`,
      [reference, GATEWAY || "manual", subjectType, own[0].id, session.id, amount, session.phone]
    );
    return rows[0];
  });

  if (GATEWAY === "paystack") {
    try {
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `customer${session.id}@ehgamobility.gh`,
          amount: Math.round(amount * 100), // pesewas
          reference,
          currency: "GHS",
          metadata: { subject_type: subjectType, code, customer: session.phone },
        }),
      });
      const j = await res.json();
      if (j.status && j.data?.authorization_url) {
        await query("UPDATE momo_transaction SET provider_ref = $1 WHERE id = $2", [
          j.data.access_code || reference,
          result.id,
        ]);
        return Response.json(
          { data: result, payment_url: j.data.authorization_url, message: "Complete payment on the next screen." },
          { status: 201 }
        );
      }
    } catch (e) {
      // fall through to manual queue
    }
  }

  return Response.json(
    {
      data: result,
      message:
        "MoMo payment request queued (GHS " +
        amount.toFixed(2) +
        "). Online payment activates once the gateway key is configured - our accountant will confirm your payment, or pay on delivery.",
    },
    { status: 201 }
  );
});