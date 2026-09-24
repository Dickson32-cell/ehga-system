import { apiHandler } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Avatar storage rules (the system's FIRST upload surface — kept tight):
 *  - PUT /api/portal/avatar: multipart form, field "file".
 *    Types: image/jpeg, image/png, image/webp ONLY. Max 2 MB raw.
 *    Stored base64 inside the customer's own row — no filesystem, no CDN,
 *    nothing public: served ONLY to the signed-in owner via GET.
 *  - GET serves the image bytes (content-type + cache headers).
 *  - DELETE removes it.
 * Row-level: every query filters by the session customer id.
 */
const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_BYTES = 2 * 1024 * 1024;

export const PUT = apiHandler(async (req) => {
  const me = await requireCustomer();

  const ct = req.headers.get("content-type") || "";
  if (!ct.startsWith("multipart/form-data")) {
    return Response.json({ error: "Send the photo as a form upload" }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "Choose a photo to upload" }, { status: 400 });
  }
  const mime = file.type || "";
  if (!ALLOWED[mime]) {
    return Response.json(
      { error: "Photo must be a JPG, PNG or WebP image" },
      { status: 415 }
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return Response.json({ error: "The file is empty" }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return Response.json(
      { error: "Photo is too large — please use an image up to 2 MB" },
      { status: 413 }
    );
  }
  // Magic-byte sniff: trust the content, not just the declared type.
  const b = buf;
  const isJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng =
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isWebp =
    b.slice(8, 12).toString("ascii") === "WEBP";
  const sniffed = isJpg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : null;
  if (!sniffed || sniffed !== mime) {
    return Response.json({ error: "That file is not a valid image" }, { status: 415 });
  }

  const b64 = buf.toString("base64");
  await query(
    `UPDATE customer
        SET avatar_mimetype = $1, avatar_data = $2, avatar_updated_at = now()
      WHERE id = $3`,
    [mime, b64, me.id]
  );

  return Response.json({ ok: true, size: buf.length, mimetype: mime });
});

export const GET = apiHandler(async () => {
  const me = await requireCustomer();
  const { rows } = await query(
    "SELECT avatar_mimetype, avatar_data, avatar_updated_at FROM customer WHERE id = $1",
    [me.id]
  );
  const c = rows[0];
  if (!c || !c.avatar_data) {
    return new Response(JSON.stringify({ error: "No photo yet" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const bytes = Buffer.from(c.avatar_data, "base64");
  const body = new Uint8Array(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": c.avatar_mimetype || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=60",
    },
  });
});

export const DELETE = apiHandler(async () => {
  const me = await requireCustomer();
  await query(
    "UPDATE customer SET avatar_mimetype = NULL, avatar_data = NULL, avatar_updated_at = NULL WHERE id = $1",
    [me.id]
  );
  return Response.json({ ok: true });
});