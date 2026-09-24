"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Customer profile: photo (upload / replace / remove), editable full name,
 * password change. Phone is the account identity — displayed, not editable.
 * Ink-on-paper styling: ledger panel, no cards-in-grid, no emoji.
 */
export default function ProfileClient({ session }) {
  const [profile, setProfile] = useState(null);
  const [avatarVer, setAvatarVer] = useState(Date.now()); // cache-buster after upload
  const [name, setName] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    const r = await fetch("/api/portal/profile");
    if (!r.ok) return;
    const j = await r.json();
    setProfile(j);
    setName(j.full_name || "");
  }
  useEffect(() => { load(); }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setError(""); setMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not save");
      setMsg("Profile updated.");
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function changePassword(e) {
    e.preventDefault();
    setError(""); setMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: curPw, next_password: newPw }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not change password");
      setMsg("Password changed.");
      setCurPw(""); setNewPw("");
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function uploadAvatar(e) {
    e.preventDefault();
    setError(""); setMsg("");
    const f = fileRef.current?.files?.[0];
    if (!f) { setError("Choose a photo first."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/portal/avatar", { method: "PUT", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Upload failed");
      setMsg("Photo updated.");
      setAvatarVer(Date.now());
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function removeAvatar() {
    setError(""); setMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/portal/avatar", { method: "DELETE" });
      if (!r.ok) throw new Error("Could not remove photo");
      setMsg("Photo removed.");
      setAvatarVer(Date.now());
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  if (!profile) return <p className="hint">Loading your profile…</p>;

  const initials = (profile.full_name || "?")
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My profile</h1>
          <p className="panel-note">Your photo and details. Your phone number is your account identity and cannot be changed here.</p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {msg ? <div className="form-ok">{msg}</div> : null}

      <div className="panel">
        <h2>Profile photo</h2>
        <div className="profile-row">
          {profile.has_avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="avatar"
              src={`/api/portal/avatar?v=${avatarVer}`}
              alt="Your profile photo"
              width="96"
              height="96"
            />
          ) : (
            <span className="avatar avatar-fallback" aria-hidden="true">{initials}</span>
          )}
          <form className="profile-avatar-form" onSubmit={uploadAvatar}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose a new profile photo"
            />
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>Upload photo</button>
              {profile.has_avatar ? (
                <button className="btn ghost" type="button" onClick={removeAvatar} disabled={busy}>
                  Remove photo
                </button>
              ) : null}
            </div>
            <p className="hint">JPG, PNG or WebP — up to 2 MB. Only you can see your photo.</p>
          </form>
        </div>
      </div>

      <div className="panel">
        <h2>Details</h2>
        <dl className="ledger-list">
          <div className="ledger-row"><dt>Phone</dt><dd><b>{profile.phone}</b></dd></div>
          <div className="ledger-row"><dt>Member since</dt><dd>{new Date(profile.member_since).toLocaleDateString()}</dd></div>
          <div className="ledger-row">
            <dt>Activity</dt>
            <dd>
              {profile.activity.bookings} bookings · {profile.activity.parcels} parcels ·{" "}
              {profile.activity.hires} hires · {profile.activity.school} school runs
            </dd>
          </div>
        </dl>
        <form onSubmit={saveProfile}>
          <label className="field">
            <span>Full name</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>Save changes</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Change password</h2>
        <form onSubmit={changePassword}>
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              value={curPw}
              autoComplete="current-password"
              onChange={(e) => setCurPw(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>New password (at least 8 characters)</span>
            <input
              type="password"
              value={newPw}
              minLength={8}
              autoComplete="new-password"
              onChange={(e) => setNewPw(e.target.value)}
              required
            />
          </label>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>Change password</button>
          </div>
        </form>
      </div>
    </>
  );
}