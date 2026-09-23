import crypto from "crypto";

/**
 * Simple in-memory rate limiter for sensitive endpoints (login, OTP-style
 * actions). Per-process memory — on serverless each instance has its own
 * bucket, which is fine for raising the cost of brute force; a real DDoS
 * defense belongs at the edge (Vercel firewall), not in app code.
 *
 * Usage: const fail = rateLimit(key, max, windowMs); if (fail) return 429.
 */
const buckets = new Map();

function sweep(now) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.reset < now) buckets.delete(k);
  }
}

export function rateLimit(key, max = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return null;
  }
  b.count += 1;
  if (b.count > max) {
    return { retryAfterSec: Math.ceil((b.reset - now) / 1000) };
  }
  return null;
}

/** Extract a coarse client identity from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return (fwd.split(",")[0] || "unknown").trim();
}

/** Timing-safe string comparison for token/signature checks. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) {
    // Still burn a compare to flatten timing, then fail.
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}