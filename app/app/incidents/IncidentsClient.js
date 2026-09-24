"use client";

import { useEffect, useState } from "react";
import useAutoRefresh from "@/lib/useAutoRefresh";

const TYPES = ["Accident", "Breakdown", "Tyre", "Engine", "Delay", "Customer complaint", "Cargo damage", "Other"];
const SEVERITIES = ["Minor", "Moderate", "Severe"];
const STATUSES = ["Open", "Investigating", "Closed"];
const CAN_MANAGE = ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER"].length > 0;

export default function IncidentsClient({ role, fullName }) {
  const canManage = role === "MANAGING_DIRECTOR" || role === "OPERATIONS_MANAGER";
  const [rows, setRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Breakdown",
    severity: "Minor",
    vehicle_id: "",
    description: "",
    action_taken: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/incidents");
    const j = await res.json().catch(() => ({}));
    if (res.ok) setRows(j.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/registers/fleet?limit=30")
      .then((r) => r.json())
      .then((j) => setVehicles(j.data || []))
      .catch(() => {});
  }, []);

  // Incident list updates as staff report from the field — refresh every 30 s.
  useAutoRefresh(load, 30000);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reported_by: fullName }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not report incident");
      setOkMsg("Incident " + j.data.incident_code + " reported. The MD is notified on the dashboard.");
      setForm({ ...form, description: "", action_taken: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(id, status) {
    setError("");
    const res = await fetch("/api/incidents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) load();
    else setError((await res.json().catch(() => ({}))).error || "Update failed");
  }

  const open = rows.filter((r) => r.status !== "Closed");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Incident register</h1>
          <p className="panel-note">
            Accidents, breakdowns, delays, complaints — reported by any staff, managed by the MD and
            Operations Manager. Quality and safety feed the dashboard.
          </p>
        </div>
        <div>
          <span className="badge warn">{open.length} open</span>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {okMsg ? <div className="form-ok">{okMsg}</div> : null}

      <div className="panel">
        <h2>Report an incident</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="i-date">Date *</label>
              <input
                id="i-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="i-type">Type *</label>
              <select id="i-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="i-sev">Severity *</label>
              <select id="i-sev" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="i-veh">Vehicle</label>
              <select id="i-veh" value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
                <option value="">- none -</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_code} value={v.vehicle_code}>
                    {v.vehicle_code} ({v.model || v.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="i-desc">What happened? *</label>
              <textarea
                id="i-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="i-action">Immediate action taken</label>
              <textarea
                id="i-action"
                rows={2}
                value={form.action_taken}
                onChange={(e) => setForm({ ...form, action_taken: e.target.value })}
              />
            </div>
          </div>
          <div className="actions">
            <button className="btn" type="submit">
              Report incident
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>All incidents</h2>
        {loading ? (
          <p className="hint">Loading…</p>
        ) : !rows.length ? (
          <p className="hint">No incidents recorded. That is good news.</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Vehicle</th>
                  <th>Description</th>
                  <th>Reported by</th>
                  <th>Status</th>
                  {canManage ? <th>Change status</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="badge code">{r.incident_code}</span></td>
                    <td>{r.date}</td>
                    <td>{r.type}</td>
                    <td>
                      <span className={"badge " + (r.severity === "Severe" ? "bad" : r.severity === "Moderate" ? "warn" : "")}>
                        {r.severity}
                      </span>
                    </td>
                    <td>{r.vehicle_id || "-"}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 220 }}>{r.description}</td>
                    <td>{r.reported_by || "-"}</td>
                    <td>
                      <span className={"badge " + (r.status === "Closed" ? "ok" : r.status === "Open" ? "bad" : "warn")}>
                        {r.status}
                      </span>
                    </td>
                    {canManage ? (
                      <td>
                        <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)}>
                          {STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    ) : null}
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