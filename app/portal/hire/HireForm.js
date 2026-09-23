"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SERVICE_TYPES = [
  "Standard seat",
  "Entire vehicle",
  "Airport transfer",
  "Hourly hire",
  "School run",
  "Parcel support",
];

export default function HireForm() {
  const [form, setForm] = useState({
    service_type: "Entire vehicle",
    service_date: "",
    pickup: "",
    destination: "",
    start_time: "",
    end_time: "",
    vehicle_code: "",
  });
  const [vehicles, setVehicles] = useState([]);
  const [quote, setQuote] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/portal/vehicles")
      .then((r) => r.json())
      .then((j) => setVehicles(j.data || []))
      .catch(() => {});
  }, []);

  async function getQuote() {
    setError("");
    setBusy(true);
    try {
      const direction =
        form.pickup && form.destination
          ? `Private: ${form.pickup} to ${form.destination}`
          : "Within Koforidua";
      const res = await fetch("/api/portal/hire-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          vehicle_code: form.vehicle_code || null,
          pickup: form.pickup,
          destination: form.destination,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Quote failed");
      setQuote(j.data);
    } catch (e) {
      setError(e.message + " (final quote is confirmed by the MD)");
   } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const direction = `Private: ${form.pickup} to ${form.destination}`;
      const res = await fetch("/api/portal/private-hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, direction }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Request failed");
      setDone(j);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="panel portal-done">
        <h2>Request received — {done.data.hire_code}</h2>
        <p>
          Auto-quote: <b>GHS {Number(done.data.quoted_amount).toFixed(2)}</b> ({done.quote.km} km
          {done.quote.vehicleRate ? ` @ GHS ${done.quote.vehicleRate}/km + GHS ${done.quote.base} base` : ""})
        </p>
        <p className="hint">
          The Managing Director confirms the final price shortly — you&apos;ll see it in My account with
          the assigned car.
        </p>
        <div className="actions">
          <Link className="btn" href="/portal/dashboard">My private hires</Link>
          <button className="btn secondary" type="button" onClick={() => setDone(null)}>
            Request another
          </button>
        </div>
      </div>
    );
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Request private hire</h1>
          <p className="panel-note">
            Instant distance-based quote, confirmed by the Managing Director. No payment until confirmed.
          </p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="panel">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="h-type">Service type *</label>
              <select
                id="h-type"
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="h-date">Date *</label>
              <input
                id="h-date"
                type="date"
                min={minDate}
                value={form.service_date}
                onChange={(e) => setForm({ ...form, service_date: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="h-veh">Preferred car (optional)</label>
              <select
                id="h-veh"
                value={form.vehicle_code}
                onChange={(e) => setForm({ ...form, vehicle_code: e.target.value })}
              >
                <option value="">Assign for me</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_code} value={v.vehicle_code}>
                    {v.model || v.type} · {v.color} · {v.registration || v.vehicle_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="h-pickup">Pickup *</label>
              <input
                id="h-pickup"
                placeholder="e.g. Koforidua Jackson Park"
                value={form.pickup}
                onChange={(e) => setForm({ ...form, pickup: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="h-dest">Destination *</label>
              <input
                id="h-dest"
                placeholder="e.g. Kotoka International Airport"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="h-start">Start time</label>
              <input
                id="h-start"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="h-end">End time (hourly hire)</label>
              <input
                id="h-end"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="actions">
            <button className="btn secondary" type="button" onClick={getQuote} disabled={busy || !form.pickup || !form.destination}>
              Get instant quote
            </button>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Request hire"}
            </button>
          </div>

          {quote ? (
            <div className="notice info" style={{ marginTop: "0.8rem" }}>
              Estimated <b>GHS {Number(quote.estimate).toFixed(2)}</b>
              {quote.breakdown ? (
                <ul style={{ margin: "0.5rem 0 0.2rem", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
                  {quote.breakdown.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {quote.vehicleRate === 0 && quote.fuelCost ? (
                <div style={{ marginTop: "0.2rem" }}>
                  {quote.km} km at {quote.kmPerLitre} km per litre — fuel alone costs about GHS{" "}
                  {Number(quote.fuelCost).toFixed(2)} at GHS {Number(quote.fuelPrice).toFixed(2)}/L.
                </div>
              ) : null}
              Final price confirmed by the MD.
            </div>
          ) : null}
        </form>
      </div>
    </>
  );
}