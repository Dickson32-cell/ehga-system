
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

function cs() {
  const env = fs.readFileSync("E:/RameTech Consultancy jobs/EHGA_Mobility/ehga-system/.env.local", "utf8");
  return Buffer.from(env.match(/DATABASE_URL_B64=(.+)/)[1].trim(), "base64").toString("utf8");
}
function genPassword() {
  const words = ["Accra","Koforidua","Elantra","Zongo","Jackson","Kwahu","Birim","Akuapem"];
  const w = words[crypto.randomInt(words.length)];
  return w + crypto.randomInt(1000,9999) + "!@#$%&*"[crypto.randomInt(6)];
}
const STAFF = [
  ["md.ehga","Managing Director","MANAGING_DIRECTOR"],
  ["ops.ehga","Operations Manager","OPERATIONS_MANAGER"],
  ["dispatch.ehga","Dispatcher","DISPATCHER"],
  ["accounts.ehga","Accountant","ACCOUNTANT"],
];
(async () => {
  const c = new Client({ connectionString: cs(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const lines = [
    "EHGA MOBILITY OPERATIONS SYSTEM - STAFF CREDENTIALS",
    "Generated: " + new Date().toISOString(),
    "System: ehga-mobility (see README.md in ehga-system)",
    "",
    "VEHICLES (seeded from the operations workbook):",
    "  ELA-01..ELA-04 - Hyundai Elantra (Intercity x2, Overflow/private hire, Backup/private hire)",
    "  CAM-01 - Toyota Camry (Premium private hire)",
    "  I10-01 - Hyundai i10 (School and local)",
    "  BIKE-01, BIKE-02 - Motorbikes (Parcel pickup and delivery)",
    "",
    "STAFF USERS (passwords shown once; store safely):",
  ];
  for (const [u, full, role] of STAFF) {
    const pw = genPassword();
    const hash = await bcrypt.hash(pw, 10);
    await c.query(
      `INSERT INTO app_user(username, full_name, role, password_hash) VALUES ($1,$2,$3,$4)
       ON CONFLICT (username) DO UPDATE SET password_hash = $4, active = TRUE`,
      [u, full, role, hash]
    );
    lines.push(`  ${u}  (${role})  password: ${pw}`);
  }
  fs.writeFileSync("E:/RameTech Consultancy jobs/EHGA_Mobility/CREDENTIALS.txt", lines.join("\n") + "\n", { mode: 0o600 });
  const users = await c.query("SELECT username, role, active FROM app_user ORDER BY id");
  console.log(users.rows.map(r => r.username + ":" + r.role + ":" + (r.active ? "active" : "inactive")).join(", "));
  await c.end();
  console.log("CREDENTIALS.txt rewritten with fresh passwords");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
