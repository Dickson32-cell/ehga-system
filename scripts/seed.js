/* Idempotent seed: 8 vehicles from the operations workbook + 4 staff users.
   Generates random passwords for NEW users only (existing users are left untouched).
   Writes E:/RameTech Consultancy jobs/EHGA_Mobility/CREDENTIALS.txt (never printed to console).
   NO transaction/test data is seeded. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.DATABASE_URL_B64) {
    return Buffer.from(process.env.DATABASE_URL_B64, "base64").toString("utf8");
  }
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const txt = fs.readFileSync(envPath, "utf8");
    const m = txt.match(/DATABASE_URL_B64=(.+)/);
    if (m) return Buffer.from(m[1].trim(), "base64").toString("utf8");
    const m2 = txt.match(/DATABASE_URL=(.+)/);
    if (m2) return m2[1].trim();
  }
  throw new Error("No database connection string found");
}

function genPassword() {
  const words = ["Accra", "Koforidua", "Elantra", "Momo", "Zongo", "Jackson", "Oyibi", "Kwahu"];
  const w = words[crypto.randomInt(words.length)];
  const n = crypto.randomInt(1000, 9999);
  const sym = "!@#$%&*"[crypto.randomInt(6)];
  return w + n + sym;
}

const VEHICLES = [
  ["ELA-01", "Saloon car", "Intercity", "Hyundai Elantra", "Silver"],
  ["ELA-02", "Saloon car", "Intercity", "Hyundai Elantra", "Silver"],
  ["ELA-03", "Saloon car", "Overflow and private hire", "Hyundai Elantra", "Silver"],
  ["ELA-04", "Saloon car", "Backup and private hire", "Hyundai Elantra", "Silver"],
  ["CAM-01", "Saloon car", "Premium private hire", "Toyota Camry", "Black"],
  ["I10-01", "Compact car", "School and local", "Hyundai i10", "White"],
  ["BIKE-01", "Motorbike", "Parcel pickup and delivery", "Motorbike", "Red"],
  ["BIKE-02", "Motorbike", "Parcel pickup and delivery", "Motorbike", "Blue"],
];

const STAFF = [
  { username: "md.ehga", full_name: "Managing Director", role: "MANAGING_DIRECTOR" },
  { username: "ops.ehga", full_name: "Operations Manager", role: "OPERATIONS_MANAGER" },
  { username: "dispatch.ehga", full_name: "Dispatcher", role: "DISPATCHER" },
  { username: "accounts.ehga", full_name: "Accountant", role: "ACCOUNTANT" },
];

async function main() {
  const cs = connectionString();
  const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const credLines = [
    "EHGA MOBILITY OPERATIONS SYSTEM - STAFF CREDENTIALS",
    "Generated: " + new Date().toISOString(),
    "System: ehga-mobility (see README.md in ehga-system)",
    "",
    "VEHICLES (seeded from the operations workbook):",
  ];
  let seededVehicles = 0;
  for (const [code, type, role, model, color] of VEHICLES) {
    await client.query(
      `INSERT INTO vehicle (vehicle_code, type, primary_role, model, color, opening_odometer, current_odometer, status)
       VALUES ($1,$2,$3,$4,$5,0,0,'Available')
       ON CONFLICT (vehicle_code) DO NOTHING`,
      [code, type, role, model, color]
    );
    const r = await client.query("SELECT vehicle_code FROM vehicle WHERE vehicle_code=$1", [code]);
    if (r.rows.length) seededVehicles++;
    credLines.push(`  ${code} - ${model} (${type}, ${role})`);
  }

  credLines.push("", "STAFF USERS (passwords shown once; store safely):");

  for (const s of STAFF) {
    const existing = await client.query("SELECT id FROM app_user WHERE username=$1", [s.username]);
    if (existing.rows.length) {
      credLines.push(`  ${s.username}  (${s.role})  - existing user, password unchanged`);
      continue;
    }
    const pw = genPassword();
    const hash = await bcrypt.hash(pw, 10);
    await client.query(
      "INSERT INTO app_user(username, full_name, role, password_hash) VALUES ($1,$2,$3,$4)",
      [s.username, s.full_name, s.role, hash]
    );
    credLines.push(`  ${s.username}  (${s.role})  password: ${pw}`);
  }

  const outPath = "E:/RameTech Consultancy jobs/EHGA_Mobility/CREDENTIALS.txt";
  const newPwLines = credLines.filter((l) => l.includes("password:"));
  if (newPwLines.length) {
    // Append-only: never truncate, so previously issued passwords survive re-runs.
    fs.appendFileSync(
      outPath,
      `-- Seeded ${new Date().toISOString()} (new accounts only; existing passwords unchanged) --\n` +
        newPwLines.join("\n") + "\n"
    );
  }

  const users = await client.query("SELECT username, role FROM app_user ORDER BY id");
  const veh = await client.query("SELECT count(*)::int n FROM vehicle");
  const bookings = await client.query("SELECT count(*)::int n FROM booking");
  await client.end();

  console.log("Vehicles in DB:", veh.rows[0].n, "(seeded this run:", seededVehicles + ")");
  console.log("Users in DB:", users.rows.map((r) => r.username + ":" + r.role).join(", "));
  console.log("Booking rows:", bookings.rows[0].n, "(must be 0 - no test data seeded)");
  console.log("Credential file:", outPath, "(appended only when new accounts are created)");
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
