"use client";

import { useEffect, useRef, useState } from "react";

/**
 * My job (drivers & riders): today's assignment, one-tap "allow location +
 * allow alerts" GPS reporting while on duty, pre-departure sign-off, fuel log
 * quick entry and parcel POD — all from the phone.
 */
const CHECKS = [
  ["bookings_confirmed", "All bookings confirmed"],
  ["payments_received", "Payments / balances recorded"],
  ["manifest_printed", "Manifest checked"],
  ["vehicle_ok", "Vehicle checks done (tyres, fuel, lights)"],
  ["gps_on", "Location sharing ON"],
];

export default function JobClient({ session }) {
  const [assigned, setAssigned] = useState(null);
  const [today, setToday] = useState([]);
  const [signoff, setSignoff] = useState(null);
  const [checks, setChecks] = useState({});
  const [tracking, setTracking] = useState(false);
  const [lastPing, setLastPing] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const watchId = useRef(null);
  const isField = session.role === "DRIVER" || session.role === "RIDER";

  useEffect(() => {
    fetch("/api/registers/dispatch?limit=30")
      .then((r) => r.json())
      .then((j) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const mine = (j.data || []).filter(
          (d) =>
            !d.deleted &&
            d.date === todayStr &&
            (d.driver === session.full_name || d.driver === session.username)
        );
        setToday(mine);
        if (mine.length) loadSignoff(mine[0].id);
      })
      .catch(() => {});

    fetch("/api/registers/fleet?limit=30")
      .then((r) => r.json())
      .then((j) => {
        const mine = (j.data || []).find((v) => v.assigned_driver === session.full_name);
        setAssigned(mine || null);
      })
      .catch(() => {});
  }, [session.full_name, session.username]);

  async function loadSignoff(dispatchId) {
    const res = await fetch(`/api/dispatch/signoff?dispatch_id=${dispatchId}`);
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.data) {
      setSignoff(j.data);
      const done = {};
      for (const c of (j.data.checks || "").split(",")) if (c) done[c] = true;
      setChecks(done);
    }
  }

  async function signOff() {
    const dispatchId = today[0]?.id;
    if (!dispatchId) {
      setError("No dispatch row assigned to you today.");
      return;
    }
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/dispatch/signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispatch_id: dispatchId,
          checks: Object.keys(checks).filter((k) => checks[k]),
          gps_ok: tracking,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Sign-off failed");
      setSignoff(j.data);
      setMsg("Departure signed off — safe trip!");
    } catch (e) {
      setError(e.message);
    }
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setError("This phone does not support location sharing.");
      return;
    }
    setError("");
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/tracking/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed_kph: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
              heading: pos.coords.heading,
              accuracy_m: pos.coords.accuracy,
            }),
          });
          const j = await res.json().catch(() => ({}));
          setLastPing(new Date());
          if (res.ok && j.reason) setMsg(j.reason);
        } catch {}
      },
      (err) => setError("Location error: " + err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    setTracking(true);
    setMsg("Location sharing ON — office can see your position while on duty.");
  }

  function stopTracking() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setTracking(false);
    setMsg("Location sharing off.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My job — {session.full_name}</h1>
          <p className="panel-note">
            {isField
              ? "Your assignment, departure sign-off and location sharing. Keep location ON while on duty."
              : "Field view (drivers and riders see GPS reporting here)."}
          </p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {msg ? <div className="form-ok">{msg}</div> : null}

      <div className="panel">
        <h2>Today&apos;s assignment</h2>
        {assigned ? (
          <p>
            Vehicle <b>{assigned.vehicle_code}</b> — {assigned.model || assigned.type} ·{" "}
            {assigned.color} · {assigned.registration || "plate TBA"}
          </p>
        ) : (
          <p className="hint">No vehicle assigned to you yet today — the office assigns it in Fleet.</p>
        )}
        {today.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Route</th>
                  <th>Departure</th>
                  <th>Decision</th>
                  <th>Booked</th>
                </tr>
              </thead>
              <tbody>
                {today.map((d) => (
                  <tr key={d.id}>
                    <td><span className="badge code">{d.dispatch_code}</span></td>
                    <td>{d.direction}</td>
                    <td>{d.departure_time || d.scheduled_departure || "-"}</td>
                    <td><span className={"badge " + (d.decision === "Go" ? "ok" : "warn")}>{d.decision}</span></td>
                    <td>
                      {d.seats_booked}/{d.seat_capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No dispatch rows for you today.</p>
        )}
      </div>

      {isField ? (
        <div className="panel">
          <h2>Location sharing</h2>
          <p className="panel-note">
            One tap: allow location + allow alerts. Customers and the office only see position while
            you are on duty.
          </p>
          <div className="actions">
            {!tracking ? (
              <button className="btn" type="button" onClick={startTracking}>
                Start sharing location
              </button>
            ) : (
              <>
                <span className="pulse live" /> <b>Sharing live</b>
                {lastPing ? <span className="hint">last ping {lastPing.toLocaleTimeString()}</span> : null}
                <button className="btn danger" type="button" onClick={stopTracking}>
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {today.length ? (
        <div className="panel">
          <h2>Before departure — driver sign-off</h2>
          {signoff ? (
            <p className="form-ok">
              Signed off by {signoff.signed_by} at {new Date(signoff.signed_at).toLocaleString()}
            </p>
          ) : null}
          <div className="signoff-box">
            {CHECKS.map(([key, label]) => (
              <label key={key} className="checkline">
                <input
                  type="checkbox"
                  checked={!!checks[key]}
                  onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
            <div className="actions">
              <button className="btn" type="button" onClick={signOff}>
                {signoff ? "Update sign-off" : "Sign off before departure"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}