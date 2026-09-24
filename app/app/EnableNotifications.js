"use client";

import { useEffect, useState } from "react";

/**
 * One-line "Enable notifications" control (ink-on-paper: quiet text button).
 * Registers /sw.js, asks the browser for permission, saves the subscription.
 * Handles the iOS rule (push only works for installed PWAs) with a plain hint.
 */
export default function EnableNotifications() {
  const [state, setState] = useState("loading"); // loading | unsupported | no-sw | off | on | denied | needs-install
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        const res = await fetch("/api/push/subscribe");
        const j = await res.json().catch(() => ({}));
        if (existing) {
          setEndpoint(existing.endpoint);
          setState("on");
        } else if (Notification.permission === "denied") {
          setState("denied");
        } else {
          setState("off");
        }
      } catch {
        setState("no-sw");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        setBusy(false);
        return;
      }
      const { applicationServerKey } = await fetch("/api/push/subscribe")
        .then((r) => r.json());
      if (!applicationServerKey) {
        setBusy(false);
        return;
      }
      // Reuse an existing subscription if this browser already has one.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(applicationServerKey),
        });
      }
      const body = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEndpoint(body.endpoint);
        setState("on");
        // Ask the worker to confirm by showing nothing — real pushes arrive later.
      } else {
        setState("off");
      }
    } catch {
      setState("off");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      if (endpoint) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("off");
      setEndpoint(null);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported" || state === "no-sw" || state === "needs-install") {
    return null; // stay silent on unsupported browsers
  }

  if (state === "on") {
    return (
      <button className="btn ghost" type="button" onClick={disable} disabled={busy}>
        Notifications on — turn off
      </button>
    );
  }

  if (state === "denied") {
    return (
      <p className="hint">Notifications are blocked in your browser settings. Allow them for this site to receive alerts.</p>
    );
  }

  return (
    <div>
      <button className="btn" type="button" onClick={enable} disabled={busy}>
        Enable notifications
      </button>
      <p className="hint">Get alerts on this device even when the app is closed.</p>
    </div>
  );
}

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64String);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
