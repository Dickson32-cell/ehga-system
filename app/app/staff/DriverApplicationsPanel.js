"use client";

import { useEffect, useState } from "react";

const DOCS_LABEL = {
  ghana_card_image: "Ghana Card",
};

function Doc({ dataUrl, label }) {
  if (!dataUrl) return null;
  const first = dataUrl.split("|")[0];
  return (
    <a className="da-doc" href={first} target="_blank" rel="noreferrer">
      <img src={first} alt={label} />
      <span>{label}</span>
    </a>
  );
}

export default function DriverApplicationsPanel({ myRole }) {
  const [apps, setApps] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const canReview = myRole === "MANAGING_DIRECTOR" || myRole === "HR";

  async function load() {
    const r = await fetch("/api/drivers/applications");
    if (r.ok) {
      const j = await r.json();
      setApps(j.applications || []);
    } else setApps([]);
  }
  useEffect(() => { if (canReview) load(); }, [canReview]);

  async function decide(id, decision) {
    setBusyId(id);
    setMsg("");
    const r = await fetch("/api/drivers/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, note }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? (decision === "approve" ? `Approved — staff account: ${j.username} (driver sets a new password at first login)` : "Application declined") : (j.error || "Failed"));
    setBusyId(null);
    if (r.ok) load();
  }

  if (!canReview) return null;
  if (!apps) return <div className="panel"><h2>Driver applications</h2><p className="panel-note">Loading…</p></div>;

  const pending = apps.filter((a) => a.status === "pending");
  const others = apps.filter((a) => a.status !== "pending");

  return (
    <div className="panel">
      <h2>Driver applications {pending.length ? `(${pending.length} pending)` : ""}</h2>
      {msg ? <div className="form-ok">{msg}</div> : null}
      {!apps.length ? <p className="panel-note">No applications yet.</p> : null}
      {pending.map((a) => (
        <div key={a.id} className="da-app">
          <div className="da-app-head">
            <b>{a.full_name}</b>
            <span>{a.phone}</span>
          </div>
          <div className="da-app-grid">
            <div><span>Licence</span><b>{a.license_no}</b><i>exp {a.license_expiry}</i></div>
            <div><span>Ghana Card</span><b>{a.ghana_card_no}</b></div>
            <div><span>Vehicle</span><b>{a.vehicle_reg_no}</b><i>{a.vehicle_color}{a.vehicle_make ? " · " + a.vehicle_make : ""}</i></div>
            <div><span>Insurance</span><i>exp {a.insurance_expiry}</i></div>
            <div><span>Roadworthy</span><i>exp {a.roadworthy_expiry}</i></div>
          </div>
          <div className="da-docs">
            <Doc dataUrl={a.ghana_card_image} label="Ghana Card" />
            {(a.vehicle_images || "").split("|").filter(Boolean).map((u, i) => (
              <Doc key={i} dataUrl={u} label={"Vehicle " + (i + 1)} />
            ))}
          </div>
          <div className="da-decide">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to file (optional)" />
            <button className="btn" disabled={busyId === a.id} onClick={() => decide(a.id, "approve")}>Approve</button>
            <button className="btn danger" disabled={busyId === a.id} onClick={() => decide(a.id, "decline")}>Decline</button>
          </div>
        </div>
      ))}
      {others.length ? (
        <details className="da-history">
          <summary>Reviewed history ({others.length})</summary>
          {others.map((a) => (
            <div key={a.id} className="da-app-row">
              <b>{a.full_name}</b>
              <span>{a.vehicle_reg_no}</span>
              <em className={a.status === "approved" ? "ok" : "bad"}>{a.status}</em>
              {a.review_note ? <i>{a.review_note}</i> : null}
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}