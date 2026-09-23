"use client";

import { useEffect, useState } from "react";

const LIST_KEYS = [
  "directions", "payment_methods", "booking_statuses", "parcel_statuses",
  "dispatch_decisions", "private_hire_statuses", "school_payment_statuses",
  "vehicle_statuses", "service_types", "parcel_sizes", "incident_statuses",
];

const TARGET_KEYS = [
  ["standard_fare", "Standard fare per seat (GHS)"],
  ["standard_capacity", "Standard seat capacity per car"],
  ["occupancy_target", "Occupancy target (0-1)"],
  ["parcel_revenue_target", "Parcel revenue target per car-day (GHS)"],
  ["fuel_price", "Fuel price per litre (GHS)"],
  ["maintenance_reserve", "Maintenance reserve per km (GHS)"],
  ["cash_variance_tolerance", "Cash variance tolerance (GHS)"],
  ["hire_base_fare", "Private-hire base fare (GHS)"],
  ["avg_speed_kph", "Average speed for ETAs (km/h)"],
  ["route_km", "Route distances (Name:km|Name:km)"],
  ["route_endpoints", "Route map points (Name:lat,lng)"],
  ["whatsapp_line", "WhatsApp booking line (233…)"],
  ["fuel_price_per_litre", "Fuel price per litre (GHS)"],
  ["km_per_litre", "Default fuel economy (km per litre)"],
];

const LABELS = {
  directions: "Directions",
  payment_methods: "Payment methods",
  booking_statuses: "Booking statuses",
  parcel_statuses: "Parcel statuses",
  dispatch_decisions: "Dispatch decisions",
  private_hire_statuses: "Private-hire statuses",
  school_payment_statuses: "School payment statuses",
  vehicle_statuses: "Vehicle statuses",
  service_types: "Private-hire service types",
  parcel_sizes: "Parcel sizes",
  incident_statuses: "Incident statuses",
};

export default function SetupClient({ canEdit }) {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/setup");
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Failed to load setup");
      return;
    }
    const json = await res.json();
    const map = {};
    for (const r of json.data) map[r.key] = r.value;
    setRows(map);
    setDrafts({ ...map });
  }

  useEffect(() => { load(); }, []);

  async function save(keys) {
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const payload = {};
      for (const k of keys) payload[k] = drafts[k] ?? "";
      const res = await fetch("/api/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Save failed");
      const map = {};
      for (const r of json.data) map[r.key] = r.value;
      setRows(map);
      setDrafts({ ...map });
      setOkMsg("Setup saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Setup</h1>
          <p className="panel-note">
            Controlled lists and operating targets used across all registers and the dashboard.
            {canEdit ? "" : " View only - your role cannot edit setup."}
          </p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {okMsg ? <div className="form-ok">{okMsg}</div> : null}

      <div className="panel">
        <h2>Operating targets</h2>
        <div className="form-grid">
          {TARGET_KEYS.map(([k, label]) => (
            <div className="field" key={k}>
              <label htmlFor={"t-" + k}>{label}</label>
              <input
                id={"t-" + k}
                type="number"
                step="0.01"
                value={drafts[k] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
        {canEdit ? (
          <div className="actions">
            <button className="btn" onClick={() => save(TARGET_KEYS.map(([k]) => k))} disabled={busy} type="button">
              Save targets
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h2>Controlled lists</h2>
        <p className="panel-note" style={{ marginBottom: "0.8rem" }}>
          Options are pipe-separated and feed every register form and API validation.
        </p>
        <div className="form-grid">
          {LIST_KEYS.map((k) => (
            <div className="field" key={k}>
              <label htmlFor={"l-" + k}>{LABELS[k] || k}</label>
              <input
                id={"l-" + k}
                type="text"
                value={drafts[k] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                disabled={!canEdit}
              />
              <div className="hint">{(rows[k] || "").split("|").filter(Boolean).length} options</div>
            </div>
          ))}
        </div>
        {canEdit ? (
          <div className="actions">
            <button className="btn" onClick={() => save(LIST_KEYS)} disabled={busy} type="button">
              Save lists
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
