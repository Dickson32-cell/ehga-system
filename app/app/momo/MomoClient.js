"use client";

import { useEffect, useState } from "react";

/** MoMo control panel: in-app payments queue + manual reconciliation. */
export default function MomoClient() {
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