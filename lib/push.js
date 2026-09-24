import webpush from "web-push";
import { query } from "./db";

/**
 * Web Push (VAPID). Delivers notifications while the app is CLOSED, via the
 * browser's service worker (Android Chrome/Firefox; iOS 16.4+ only for
 * installed PWAs). The OS wakes the browser briefly to show it — this works
 * even when the user is not looking at the app, but NOT with zero internet.
 */

let configured = false;
function ensureVapid() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:ops@ehgamobility.com",
    pub,
    priv
  );
  configured = true;
  return true;
}

/**
 * Send a push to every active subscription of one person.
 * Payload: { title, body, url } — the service worker renders it.
 * Dead endpoints (404/410) are deactivated automatically.
 * Never throws — push is best-effort and must not break the main action.
 */
export async function sendPush(audience, subjectId, { title, body, url }) {
  try {
    if (!ensureVapid()) return { sent: 0, reason: "vapid-not-configured" };
    const { rows } = await query(
      `SELECT id, endpoint, p256dh, auth FROM push_subscription
        WHERE audience = $1 AND subject_id = $2 AND active = TRUE`,
      [audience, subjectId]
    );
    if (!rows.length) return { sent: 0 };

    const payload = JSON.stringify({ title, body, url: url || "/" });
    let sent = 0;
    for (const s of rows) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 3600 }
        );
        sent += 1;
      } catch (err) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          await query(
            "UPDATE push_subscription SET active = FALSE, last_error = $1 WHERE id = $2",
            [`gone-${code}`, s.id]
          );
        } else {
          await query(
            "UPDATE push_subscription SET last_error = $1 WHERE id = $2",
            [String(err?.message || err).slice(0, 250), s.id]
          );
        }
      }
    }
    return { sent };
  } catch (err) {
    console.error("[PUSH-ERROR]", err?.message || err);
    return { sent: 0, reason: "error" };
  }
}

/**
 * Fan-out to every ACTIVE user holding any of the given roles.
 * Used for staff group alerts (new bookings, payments, incidents...).
 * Never throws.
 */
export async function sendPushToRoles(roles, payload) {
  try {
    if (!roles.length) return { sent: 0 };
    const { rows } = await query(
      `SELECT DISTINCT u.id FROM app_user u
         JOIN push_subscription ps ON ps.audience = 'staff' AND ps.subject_id = u.id AND ps.active = TRUE
        WHERE u.role = ANY($1) AND u.active = TRUE`,
      [roles]
    );
    let sent = 0;
    for (const r of rows) {
      const res = await sendPush("staff", r.id, payload);
      sent += res.sent || 0;
    }
    return { sent };
  } catch (err) {
    console.error("[PUSH-ROLES-ERROR]", err?.message || err);
    return { sent: 0 };
  }
}
