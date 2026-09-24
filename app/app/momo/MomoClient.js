"use client";

import { useEffect, useState } from "react";
import useAutoRefresh from "@/lib/useAutoRefresh";

/** MoMo control panel: payment number (CEO-editable) + transactions queue. */
export default function MomoClient({ role }) {
  const [rows, setRows] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function load() {
    const res = await fetch("/api/momo");
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setRows(j.data || []);
      setConfigured(!!j.gateway_configured);
    } else setError(j.error || "Load failed");
  }

  useEffect(() => {
    load();
  }, []);

  // Payment queue updates as customers pay — refresh every 20 s.
  useAutoRefresh(load, 20000);

  async function mark(id, status) {
    setError("");
    setOkMsg("");
    const res = await fetch("/api/momo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error || "Update failed");
      return;
    }
    setOkMsg("Marked " + status + " and applied to the register.");
    load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>MoMo payments</h1>
          <p className="panel-note">
            In-app MoMo: customers pay from the portal; the webhook (or you, manually) confirms and the
            amount is posted to the booking/parcel/hire/school row automatically.
          </p>
        </div>
        <span className={"badge " + (configured ? "ok" : "warn")}>
          {configured ? "Gateway live" : "Gateway key not set — manual queue"}
        </span>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {okMsg ? <div className="form-ok">{okMsg}</div> : null}

      {!configured ? (
        <div className="notice warn no-print">
          Add <code className="inline-code">PAYSTACK_SECRET_KEY</code> (Vercel env) to switch on real
          in-app MoMo collection. Until then, transactions queue here as Pending for manual
          reconciliation — nothing is lost.
        </div>
      ) : null}

      <div className="panel">
        <h2>Payment MoMo number</h2>
        <p className="panel-note">
          Where customer payments go. {role === "MANAGING_DIRECTOR"
            ? "As CEO you can change this at any time — customers see the new number on their payment screens immediately."
            : "Only the Managing Director (CEO) can change this."}
        </p>
        <MomoNumberEditor canEdit={role === "MANAGING_DIRECTOR"} />
      </div>

      <div className="panel">
        <h2>Transactions</h2>
        {!rows ? (
          <p className="hint">Loading…</p>
        ) : !rows.length ? (
          <p className="hint">No MoMo transactions yet. They appear when a customer taps Pay MoMo.</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>For</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Confirm</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="badge code">{r.reference}</span></td>
                    <td>
                      {r.subject_type} #{r.subject_id}
                    </td>
                    <td>{r.customer_name || "-"}</td>
                    <td className="num">GHS {Number(r.amount).toFixed(2)}</td>
                    <td>{r.phone || "-"}</td>
                    <td>
                      <span className={"badge " + (r.status === "Paid" ? "ok" : r.status === "Failed" ? "bad" : "warn")}>
                        {r.status}
                      </span>
                    </td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>
                      {r.status !== "Paid" ? (
                        <>
                          <button className="btn small" type="button" onClick={() => mark(r.id, "Paid")}>
                            Mark paid
                          </button>{" "}
                          <button className="btn small danger" type="button" onClick={() => mark(r.id, "Failed")}>
                            Failed
                          </button>
                        </>
                      ) : (
                        <span className="hint">posted {r.paid_at ? new Date(r.paid_at).toLocaleString() : ""}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** CEO sets the receiving MoMo number + payee name; others see it read-only. */
function MomoNumberEditor({ canEdit }) {
  const [current, setCurrent] = useState(null);
  const [number, setNumber] = useState("");
  const [payee, setPayee] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCurrent() {
    const res = await fetch("/api/momo-number");
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setCurrent(j);
      setNumber(j.number || "");
      setPayee(j.payee || "");
    }
  }

  useEffect(() => {
    loadCurrent();
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/momo-number", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, payee }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not save");
      setMsg(j.message || "Saved");
      setEditing(false);
      loadCurrent();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  if (!current) return <p className="hint">Loading…</p>;

  if (!editing) {
    return (
      <div>
        <p style={{ fontSize: "1.15rem", margin: "0.4rem 0" }}>
          <b>{current.number || "Not set yet"}</b>
          {current.payee ? <span className="hint"> · {current.payee}</span> : null}
        </p>
        {!current.number ? (
          <p className="hint">No payment number on file — customers cannot be shown where to pay until this is set.</p>
        ) : null}
        {canEdit ? (
          <button className="btn secondary" type="button" onClick={() => { setEditing(true); setMsg(""); }}>
            {current.number ? "Change number" : "Set number"}
          </button>
        ) : null}
        {msg ? <div className="form-ok">{msg}</div> : null}
      </div>
    );
  }

  return (
    <form onSubmit={save}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="mn-num">MoMo number *</label>
          <input
            id="mn-num"
            type="tel"
            placeholder="024 123 4567"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
          />
          <div className="hint">Stored as +233… — shown exactly like this to customers.</div>
        </div>
        <div className="field">
          <label htmlFor="mn-payee">Account name (payee)</label>
          <input
            id="mn-payee"
            placeholder="e.g. EHGA Mobility Ltd"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
          />
        </div>
      </div>
      {err ? <div className="form-error">{err}</div> : null}
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save payment number"}
        </button>
        <button className="btn secondary" type="button" onClick={() => { setEditing(false); setErr(""); }} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}