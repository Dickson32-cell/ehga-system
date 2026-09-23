"use client";

import { useState } from "react";

/**
 * Change-password panel: shown when the user still uses the CEO-issued
 * temporary password (must_change_password) or opened via "Account settings".
 * On success it reloads the app so the banner clears.
 */
export default function ChangePassword({ required }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setOkMsg("");
    if (next !== confirm) { setError("The two new passwords do not match"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/staff-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not change password");
      setOkMsg(j.message || "Password changed");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="panel" style={required ? { borderColor: "var(--warn)", borderWidth: 2 } : undefined}>
      {required ? (
        <>
          <h2>Set your own password</h2>
          <p className="panel-note">
            You are using a temporary password issued by the Managing Director. Choose your own
            password now — you will use it from your next sign-in.
          </p>
        </>
      ) : (
        <h2>Change my password</h2>
      )}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cp-cur">Current (temporary) password *</label>
            <input id="cp-cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="cp-new">New password * (min 8 characters)</label>
            <input id="cp-new" type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="cp-conf">Repeat new password *</label>
            <input id="cp-conf" type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {okMsg ? <div className="form-ok">{okMsg}</div> : null}
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
        </div>
      </form>
    </div>
  );
}