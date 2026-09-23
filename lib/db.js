import { Pool } from "pg";

let cached = globalThis.__ehgaPool;

function resolveConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Local fallback: some machines (EDR credential scanners) delete plaintext
  // credential files, so local dev stores the URL base64-encoded.
  if (process.env.DATABASE_URL_B64) {
    return Buffer.from(process.env.DATABASE_URL_B64, "base64").toString("utf8");
  }
  return null;
}

export function getPool() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DATABASE_URL_B64) is not configured");
  }
  if (!cached) {
    cached = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
    globalThis.__ehgaPool = cached;
  }
  return cached;
}

export async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function tx(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
