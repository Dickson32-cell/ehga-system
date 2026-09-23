"use client";

import { useEffect, useState } from "react";

/**
 * Reports hub: printable daily manifest + waybills and monthly (any period)
 * Excel export - "for the MD, bank and GRA".
 */
export default function ReportsClient({ role }) {
  const canExport = ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "ACCOUNTANT"].includes(role);
  const canManifest = ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "DISPATCHER", "ACCOUNTANT"].includes(role);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState("");
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadManifest() {
    setError("");
    setLoading(true);
    try {
      const q = new URLSearchParams({ date });
      if (direction) q.set("direction", direction);
      const res = await fetch("/api/reports/manifest?" + q.toString());
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not load manifest");
      setManifest(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function printPage() {
    window.print();
  }

  const monthStart = today.slice(0, 8) + "01";

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>Reports &amp; exports</h1>
          <p className="panel-note">
            Printable manifests and waybills for drivers; monthly Excel export of every register for
            the MD, bank and GRA.
          </p>
        </div>
      </div>

      {error ? <div className="form-error no-print">{error}</div> : null}

      <div className="panel no-print">
        <h2>Daily manifest &amp; waybills</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="r-date">Date</label>
            <input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="r-dir">Route (optional)</label>
            <select id="r-dir" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="">All routes</option>
              <option>Koforidua to Accra</option>
              <option>Accra to Koforidua</option>
              <option>Within Koforidua</option>
              <option>Within Accra</option>
            </select>
          </div>
        </div>
        <div className="actions">
          {canManifest ? (
            <button className="btn" type="button" onClick={loadManifest} disabled={loading}>
              {loading ? "Loading…" : "Load manifest"}
            </button>
          ) : null}
        </div>
      </div>

      {manifest ? (
        <div className="print-area">
          <div className="actions no-print" style={{ marginBottom: "0.8rem" }}>
            <button className="btn" type="button" onClick={printPage}>
              Print manifest
            </button>
          </div>
          <div className="panel">
            <h2>Passenger manifest — {manifest.date}</h2>
            <p className="panel-note">
              {manifest.bookings.length} passenger(s) across {manifest.dispatch.length} departure(s)
            </p>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Time</th>
                    <th>Route</th>
                    <th>Passenger</th>
                    <th>Phone</th>
                    <th>Seats</th>
                    <th>Pickup</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Sign ✓</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.bookings.map((b) => (
                    <tr key={b.booking_code}>
                      <td>{b.booking_code}</td>
                      <td>{b.departure_time || "-"}</td>
                      <td>{b.direction}</td>
                      <td>{b.customer_name}</td>
                      <td>{b.phone || "-"}</td>
                      <td>{b.seats}</td>
                      <td>{b.pickup_point || "-"}</td>
                      <td>
                        {b.vehicle_code ? `${b.vehicle_code} ${b.registration || ""}` : "TBA"}
                      </td>
                      <td>{b.status}</td>
                      <td style={{ width: 60 }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>Parcel waybills — {manifest.date}</h2>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Waybill</th>
                    <th>Sender</th>
                    <th>From</th>
                    <th>Recipient</th>
                    <th>To</th>
                    <th>Size</th>
                    <th>Charge</th>
                    <th>Vehicle</th>
                    <th>POD sign ✓</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.parcels.map((p) => (
                    <tr key={p.parcel_code}>
                      <td>{p.parcel_code}</td>
                      <td>
                        {p.sender} ({p.sender_phone || "-"})
                      </td>
                      <td style={{ whiteSpace: "normal" }}>{p.pickup_address}</td>
                      <td>
                        {p.recipient} ({p.recipient_phone || "-"})
                      </td>
                      <td style={{ whiteSpace: "normal" }}>{p.delivery_address}</td>
                      <td>{p.size}</td>
                      <td className="num">GHS {Number(p.total_charge).toFixed(2)}</td>
                      <td>{p.vehicle_code || "TBA"}</td>
                      <td style={{ width: 60 }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-note" style={{ marginTop: "0.6rem" }}>
              Driver signs the manifest before departure; recipient signs the waybill on delivery.
            </p>
          </div>
        </div>
      ) : null}

      {canExport ? (
        <div className="panel no-print">
          <h2>Monthly Excel export</h2>
          <p className="panel-note">One sheet per register, all computed columns included.</p>
          <div className="actions">
            <a className="btn" href={`/api/reports/export?from=${monthStart}&to=${today}`}>
              Export this month (Excel)
            </a>
          </div>
          <form style={{ marginTop: "0.8rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end" }}>
            <div className="field">
              <label htmlFor="x-from">From</label>
              <input id="x-from" type="date" defaultValue={monthStart} formAction="" />
            </div>
            <div className="field">
              <label htmlFor="x-to">To</label>
              <input id="x-to" type="date" defaultValue={today} />
            </div>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                const f = document.getElementById("x-from").value;
                const t = document.getElementById("x-to").value;
                window.location.href = `/api/reports/export?from=${f}&to=${t}`;
              }}
            >
              Export custom period
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}