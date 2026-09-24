"use client";

import { useEffect, useState } from "react";
import useAutoRefresh from "@/lib/useAutoRefresh";

/**
 * Customer tracking: polls /api/portal/tracking (own records ONLY) and shows
 * each active trip/parcel with the assigned car and its last known GPS
 * position on a map. Map renders OpenStreetMap tiles + Leaflet from CDN.
 */
export default function TrackClient({ focusCode }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(null);

  async function poll() {
    try {
      const res = await fetch("/api/portal/tracking");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not load tracking");
      setRows(j.data || []);
      setNow(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    poll();
  }, []);

  // Live trip tracking — refresh every 15 s while the screen is open.
  useAutoRefresh(poll, 15000);

  if (error) return <div className="form-error">{error}</div>;
  if (!rows) return <p className="hint">Loading tracking…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Track my trips</h1>
          <p className="panel-note">
            Live map of YOUR active trips — parcel en route, child on board, driver arriving. Updates
            every 15 seconds. You can only ever see your own.
          </p>
        </div>
      </div>

      {!rows.length ? (
        <div className="panel">
          <p>
            Nothing to track right now. Trips appear here once staff confirm a booking, assign a car,
            or a parcel is picked up.
          </p>
        </div>
      ) : null}

      {rows.map((r) => (
        <TripCard key={r.kind + r.code} row={r} focus={focusCode === r.code} now={now} />
      ))}
    </>
  );
}

function TripCard({ row, focus, now }) {
  const [eta, setEta] = useState(null);
  const hasFix = row.lat != null && row.lng != null;

  useEffect(() => {
    if (!hasFix || !row.lat || !row.lng) return;
    // Rough distance-to-Koforidua-hub ETA (illustrative until route matching lands)
    const R = 6371;
    const hub = { lat: 6.09, lng: -0.259 };
    const dLat = ((hub.lat - row.lat) * Math.PI) / 180;
    const dLng = ((hub.lng - row.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 + Math.cos((row.lat * Math.PI) / 180) * Math.cos((hub.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const km = 2 * R * Math.asin(Math.sqrt(a));
    const kph = Math.max(Number(row.speed_kph) || 30, 15);
    setEta(Math.round((km / kph) * 60));
  }, [hasFix, row.lat, row.lng, row.speed_kph]);

  const age = row.recorded_at ? Math.round((Date.now() - new Date(row.recorded_at).getTime()) / 60000) : null;

  return (
    <div className={"panel trip-card" + (focus ? " focus" : "")} id={"trip-" + row.code}>
      <div className="trip-head">
        <span className="badge code">{row.code}</span>
        <span className={"badge " + (row.status === "In progress" || row.status === "Boarded" ? "ok" : "warn")}>
          {row.status}
        </span>
        <span className="trip-date">
          {row.kind === "parcel" ? "Parcel" : row.kind === "private_hire" ? "Private hire" : "Seat"} ·{" "}
          {row.direction || (row.pickup_address ? `${row.pickup_address} → ${row.delivery_address}` : "")}
        </span>
      </div>

      {row.vehicle_model ? (
        <p className="carline">
          Vehicle {row.vehicle_model} · {row.vehicle_color} · <b>{row.vehicle_registration}</b>
        </p>
      ) : (
        <p className="hint">Car will appear here once assigned.</p>
      )}

      {has ? (
        <>
          <div className="mapwrap" style={{ height: 240 }}>
            <iframe
              title={"Map " + row.code}
              width="100%"
              height="100%"
              frameBorder="0"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${row.lng - 0.02},${row.lat - 0.015},${Number(row.lng) + 0.02},${Number(row.lat) + 0.015}&layer=mapnik&marker=${row.lat},${row.lng}`}
            />
          </div>
          <p className="hint" style={{ marginTop: "0.5rem" }}>
            Position: {Number(row.lat).toFixed(5)}, {Number(row.lng).toFixed(5)}
            {row.speed_kph != null ? ` · ${Math.round(Number(row.speed_kph))} km/h` : ""} · updated{" "}
            {age != null ? age + " min ago" : "—"}
            {eta != null ? ` · approx. ${eta} min to hub` : ""}
          </p>
        </>
      ) : (
        <p className="hint">Waiting for the driver&apos;s phone GPS — live position appears here once the trip starts.</p>
      )}

      <ul className="track-steps">
        {STAGES[row.kind]?.map((s) => (
          <li key={s.label} className={s.reached(row.status) ? "on" : ""}>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STAGES = {
  parcel: [
    { label: "Booked", reached: () => true },
    { label: "Collected", reached: (s) => ["Collected", "At hub", "In transit", "Out for delivery", "Delivered"].includes(s) },
    { label: "In transit", reached: (s) => ["In transit", "Out for delivery", "Delivered"].includes(s) },
    { label: "Out for delivery", reached: (s) => ["Out for delivery", "Delivered"].includes(s) },
    { label: "Delivered", reached: (s) => s === "Delivered" },
  ],
  booking: [
    { label: "Confirmed", reached: (s) => ["Confirmed", "Boarded", "Completed"].includes(s) },
    { label: "On board", reached: (s) => ["Boarded", "Completed"].includes(s) },
    { label: "Arrived", reached: (s) => s === "Completed" },
  ],
  private_hire: [
    { label: "Confirmed", reached: (s) => ["Confirmed", "In progress", "Completed"].includes(s) },
    { label: "Driver arrived", reached: (s) => ["In progress", "Completed"].includes(s) },
    { label: "Done", reached: (s) => s === "Completed" },
  ],
};