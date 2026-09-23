
const fs = require("fs");
const { Client } = require("pg");
const env = fs.readFileSync("E:/RameTech Consultancy jobs/EHGA_Mobility/ehga-system/.env.local", "utf8");
const cs = Buffer.from(env.match(/DATABASE_URL_B64=(.+)/)[1].trim(), "base64").toString("utf8");
(async () => {
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const t of ["booking","dispatch","parcel","trip","fuel","private_hire","school_student","cash_reconciliation","vehicle","app_user","serial_counter"]) {
    const r = await c.query(`SELECT count(*)::int n FROM ${t}`);
    console.log(t, "=", r.rows[0].n);
  }
  await c.end();
})();
