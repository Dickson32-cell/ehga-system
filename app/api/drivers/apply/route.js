import { apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimit, clientIp } from "@/lib/guard";
import { normalizeGhPhone } from "@/lib/customer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/drivers/apply — new driver application (public form).
 * Uploads arrive as base64 data URLs (client-side preview + size check first).
 * Rules: unique phone, password >=8, license + Ghana card + vehicle required,
 * insurance and roadworthy must NOT be expired, uploads JPEG/PNG/WebP only.
 */
const IMG_OK = /^data:image\/(jpeg|png|webp);base64,/;

function badImage(v) {
  return !v || !IMG_OK.test(v) || v.length > 3_700_000; // ~2.7 MB binary cap
}

function futureDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  return s > new Date().toISOString().slice(0, 10);
}

export const POST = apiHandler(async (req) => {
  const limited = rateLimit(`drivers:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (limited) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const fullName = String(b.full_name || "").trim();
  const phone = normalizeGhPhone(b.phone);
  const email = String(b.email || "").trim().toLowerCase() || null;
  const password = String(b.password || "");
  const licenseNo = String(b.license_no || "").trim().toUpperCase();
  const licenseExpiry = String(b.license_expiry || "").trim();
  const ghanaCard = String(b.ghana_card_no || "").trim().toUpperCase().replace(/\s+/g, "");
  const ghanaCardImg = String(b.ghana_card_image || "");
  const vehicleReg = String(b.vehicle_reg_no || "").trim().toUpperCase();
  const vehicleMake = String(b.vehicle_make || "").trim() || null;
  const vehicleColor = String(b.vehicle_color || "").trim();
  const vehicleImages = String(b.vehicle_images || "");
  const insuranceExpiry = String(b.insurance_expiry || "").trim();
  const roadworthyExpiry = String(b.roadworthy_expiry || "").trim();

  if (fullName.length < 3) return Response.json({ error: "Enter your full name" }, { status: 400 });
  if (!phone) return Response.json({ error: "Enter a valid Ghana phone number" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  if (!licenseNo) return Response.json({ error: "Enter your driver's licence number" }, { status: 400 });
  if (!futureDate(licenseExpiry)) return Response.json({ error: "Your licence must not be expired" }, { status: 400 });
  if (!/^GHA-\d{9}-\d{1}$/.test(ghanaCard) && !/^\d{10,16}$/.test(ghanaCard)) {
    return Response.json({ error: "Enter your Ghana Card number (e.g. GHA-123456789-0)" }, { status: 400 });
  }
  if (badImage(ghanaCardImg)) return Response.json({ error: "Upload a clear photo of your Ghana Card (JPG/PNG, under 2 MB)" }, { status: 400 });
  if (!vehicleReg || vehicleReg.length < 5) return Response.json({ error: "Enter the vehicle registration number" }, { status: 400 });
  if (!vehicleColor) return Response.json({ error: "Select the vehicle colour" }, { status: 400 });
  if (!futureDate(insuranceExpiry)) return Response.json({ error: "The vehicle insurance must not be expired" }, { status: 400 });
  if (!futureDate(roadworthyExpiry)) return Response.json({ error: "The roadworthy certificate must not be expired" }, { status: 400 });
  const imgs = vehicleImages ? vehicleImages.split("|").filter(Boolean) : [];
  if (!imgs.length || imgs.some((x) => badImage(x))) {
    return Response.json({ error: "Upload at least one clear photo of the vehicle (JPG/PNG, under 2 MB each)" }, { status: 400 });
  }

  const phones = await query("SELECT 1 FROM customer WHERE phone = $1 UNION ALL SELECT 1 FROM driver_application WHERE phone = $1 AND status <> 'declined' LIMIT 1", [phone]);
  if (phones.rows.length) {
    return Response.json({ error: "This phone number is already registered with us. Sign in instead, or contact the office." }, { status: 409 });
  }
  const dup = await query("SELECT 1 FROM driver_application WHERE vehicle_reg_no = $1 AND status <> 'declined' LIMIT 1", [vehicleReg]);
  if (dup.rows.length) {
    return Response.json({ error: "A driver with this vehicle registration already has an application with us." }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO driver_application
      (full_name, phone, email, password_hash, license_no, license_expiry,
       ghana_card_no, ghana_card_image, vehicle_reg_no, vehicle_make, vehicle_color,
       vehicle_images, insurance_expiry, roadworthy_expiry)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id, status`,
    [fullName, phone, email, hash, licenseNo, licenseExpiry, ghanaCard,
     ghanaCardImg, vehicleReg, vehicleMake, vehicleColor,
     imgs.join("|"), insuranceExpiry, roadworthyExpiry]
  );

  return Response.json(
    { ok: true, id: rows[0].id, message: "Application received. Our office will review it and call you within 48 hours." },
    { status: 201 }
  );
});
