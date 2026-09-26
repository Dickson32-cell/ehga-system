"use client";

import { useEffect, useState } from "react";
import useAutoRefresh from "@/lib/useAutoRefresh";
import Link from "next/link";

const DIRECTIONS = [
  "Koforidua to Accra",
  "Accra to Koforidua",
  "Within Koforidua",
  "Within Accra",
];

// Ride-style fare rows — the same fares as the departure board on the home page.
const ROUTE_META = {
  "Koforidua to Accra": { fare: "GHS 90", times: "06:00 · 10:00 · 14:00" },
  "Accra to Koforidua": { fare: "GHS 90", times: "07:00 · 11:00 · 15:00" },
  "Within Koforidua": { fare: "GHS 15", times: "On demand" },
  "Within Accra": { fare: "GHS 20", times: "On demand" },
};

export default function BookForm() {
  const [form, setForm] = useState({
    direction: DIRECTIONS[0],
    travel_date: "",
    departure_time: "",
    seats: 1,
    pickup_point: "",
    dropoff_point: "",
    notes: "",
  });
  const [vehicles, setVehicles] = useState([]);
  const [avail, setAvail] = useState(null);
  const [availMsg, setAvailMsg] = useState("");
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/portal/vehicles")
      .then((r) => r.json())
      .then((j) => setVehicles(j.data || []))
      .catch(() => {});
  }, []);

  // Live seat availability for the chosen date + route: which car fills up,
  // how many seats remain ("Full", "2 seats left"), and what takes over next.
  async function loadAvailability(date, direction, announce) {
    if (!date || !direction) {
      setAvail(null);
      setAvailMsg("");
      return;
    }
    if (announce) setAvailMsg("Checking seats…");
    try {
      const j = await fetch(`/api/portal/bookings?date=${encodeURIComponent(date)}&direction=${encodeURIComponent(direction)}`).then((r) => r.json());
      if (j.data) {
        setAvail(j.data);
        setAvailMsg(
          j.data.any_available
            ? `${j.data.total_seats_left} seat${j.data.total_seats_left === 1 ? "" : "s"} still open across our cars.`
            : "All cars are full for that date — try another date or send us a WhatsApp."
        );
      } else if (announce) setAvailMsg("");
    } catch {
      if (announce) setAvailMsg("");
    }
  }

  useEffect(() => {
    loadAvailability(form.travel_date, form.direction, true);
  }, [form.travel_date, form.direction]);

  // Seats fill while the customer decides — refresh availability every 30 s.
  useAutoRefresh(() => loadAvailability(form.travel_date, form.direction, false), 30000);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/portal/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Booking failed");
      setDone(j.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="panel portal-done">
        <h2>Booking received — {done.booking_code}</h2>
        <p>
          <b>{done.direction}</b> on {done.travel_date}
          {done.departure_time ? " at " + done.departure_time : ""} · {done.seats} seat(s) ·{" "}
          <b>GHS {Number(done.passenger_revenue).toFixed(2)}</b>
        </p>
        <p className="hint">
          Status is <b>Pending</b> — our dispatcher confirms shortly, then your car (model, colour,
          registration) appears in My account.
        </p>
        <div className="actions">
          {done.whatsapp_url ? (
            <a className="btn secondary" href={done.whatsapp_url} target="_blank" rel="noreferrer">
              Send booking on WhatsApp
            </a>
          ) : null}
          <Link className="btn" href="/portal/dashboard">Go to my bookings</Link>
          <button className="btn secondary" type="button" onClick={() => setDone(null)}>
            Book another
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
          <h1>Book a seat</h1>
          <p className="panel-note">GHS 90 per seat on intercity routes. Pay by MoMo after confirmation.</p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="panel">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Route *</label>
              <div className="lx-route-pick" role="radiogroup" aria-label="Route">
                {DIRECTIONS.map((d) => {
                  const meta = ROUTE_META[d] || {};
                  const on = form.direction === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={"lx-route-opt" + (on ? " on" : "")}
                      onClick={() => setForm({ ...form, direction: d })}
                    >
                      <span className="lx-route-name">{d}</span>
                      <span className="lx-route-times">{meta.times}</span>
                      <span className="lx-route-fare">{meta.fare}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <label htmlFor="b-date">Travel date *</label>
              <input
                id="b-date"
                type="date"
                min={minDate}
                value={form.travel_date}
                onChange={(e) => setForm({ ...form, travel_date: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="b-time">Preferred departure time</label>
              <input
                id="b-time"
                type="time"
                value={form.departure_time}
                onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
              />
            </div>
            <div className="field">
              <label id="b-seats-label">Seats *</label>
              <div className="lx-stepper" role="group" aria-labelledby="b-seats-label">
                <button
                  type="button"
                  aria-label="One seat fewer"
                  disabled={Number(form.seats) <= 1}
                  onClick={() => setForm({ ...form, seats: Math.max(1, Number(form.seats) - 1) })}
                >
                  −
                </button>
                <span aria-live="polite">{form.seats}</span>
                <button
                  type="button"
                  aria-label="One seat more"
                  disabled={Number(form.seats) >= 6}
                  onClick={() => setForm({ ...form, seats: Math.min(6, Number(form.seats) + 1) })}
                >
                  +
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="b-pick">Pickup point</label>
              <input
                id="b-pick"
                placeholder="e.g. Koforidua Jackson Park"
                value={form.pickup_point}
                onChange={(e) => setForm({ ...form, pickup_point: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="b-drop">Drop-off point</label>
              <input
                id="b-drop"
                placeholder="e.g. Accra Tetteh Quarshie"
                value={form.dropoff_point}
                onChange={(e) => setForm({ ...form, dropoff_point: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="b-notes">Notes (luggage, accessibility, anything we should know)</label>
              <textarea
                id="b-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="panel-note" style={{ margin: "0.8rem 0" }}>
            Our fleet: {vehicles.length ? vehicles.map((v) => `${v.model || v.type} (${v.registration || v.vehicle_code})`).join(" · ") : "loading…"}
          </div>

          {avail && avail.vehicles ? (
            <div className="seat-availability" style={{ margin: "0.6rem 0 1rem" }}>
              <div className="panel-note" style={{ fontWeight: 600 }}>{availMsg}</div>
              <div className="seat-cards">
                {avail.vehicles.map((v) => (
                  <div
                    key={v.vehicle_code}
                    className={"seat-card" + (v.is_full ? " full" : "")}
                  >
                    <span className="seat-car">{v.model || v.type} · {v.registration || v.vehicle_code}</span>
                    <span className={"seat-count" + (v.is_full ? " full" : v.seats_left <= 2 ? " low" : "")}>
                      {v.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Request booking"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}