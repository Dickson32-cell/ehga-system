/* Applies lib/schema.sql to the database in DATABASE_URL / DATABASE_URL_B64. */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.DATABASE_URL_B64) {
    return Buffer.from(process.env.DATABASE_URL_B64, "base64").toString("utf8");
  }
  // fall back to .env.local in project root
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const m = fs.readFileSync(envPath, "utf8").match(/DATABASE_URL_B64=(.+)/);
    if (m) return Buffer.from(m[1].trim(), "base64").toString("utf8");
    const m2 = fs.readFileSync(envPath, "utf8").match(/DATABASE_URL=(.+)/);
    if (m2) return m2[1].trim();
  }
  throw new Error("No database connection string found");
}

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "lib", "schema.sql"), "utf8");
  const client = new Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Applying schema to", connectionString().replace(/\/\/[^@]+@/, "//***@"));
  try {
    await client.query(sql);
  } catch (e) {
    console.error("Full-query failed (" + e.message + "), retrying statement-by-statement...");
    const statements = sql.split(/;\s*(?=\n|$)/);
    for (const s of statements) {
      const st = s.trim();
      if (!st) continue;
      await client.query(st + ";");
    }
  }
  const t = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log("Tables now:", t.rows.map((r) => r.table_name).join(", "));
  await client.end();
  console.log("Schema applied OK");
}

main().catch((e) => {
  console.error("SCHEMA FAILED:", e.message);
  process.exit(1);
});
