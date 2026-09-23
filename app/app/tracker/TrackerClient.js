"use client";

import { useEffect, useState } from "react";

/**
 * Fleet Tracker (diagram: "Live map of every vehicle, staff side").
 * All 8 on one map, tap a vehicle for details; route deviation / speed /
 * idle-watch flags; docs-expired and no-movement-30-min pings for the MD.
 */
export default function TrackerClient({ role }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch("/api/tracking/live");
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "Could not load tracker");
        if (!stop) {
          setRows(j.data || []);
          setLastFetch(new Date());
        }
      } catch (e) {
        if (!stop) setError(e.message);
      }
    }
    poll();
    const t = setInterval(poll, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  async function openVehicle(code) {
    setSelected(code);
    setHistory([]);
    const res = await fetch(`/api/tracking/history?vehicle=${encodeURIComponent(code)}&hours=12`);
    const j = await res.json().catch(() => ({}));
    if (res.ok) setHistory(j.data || []);
  }

  // Map bounding box across all fixes
  const fixes = (rows || []).filter((r) => r.lat != null);
  const bbox =
    fixes.length > 1
      ? [
          Math.min(...fixes.map((f) => f.lng)) - 0.15,
          Math.min(...fixes.map((f) => f.lat)) - 0.1,
          Math.max(...fixes.map((f) => f.lng)) + 0.15,
          Math.max(...fixes.map((f) => f.lat)) + 0.1,
        ]
      : [-0.45, 5.45, -0.05, 6.25];
  const markers = fixes
    .map((f) => `${f.lat},${f.lng}`)
    .join("~");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fleet Tracker</h1>
          <p className="panel-note">
            Live map of every vehicle from drivers&apos; and riders&apos; phone GPS. Updates every 15 s.
            {role === "MANAGING_DIRECTOR"
              ? " You are pinged on: no movement 30 min, insurance/roadworthy expired, vehicle off route."
              : ""}
          </p>
        </div>
        {lastFetch ? <span className="hint">Updated {lastFetch.toLocaleTimeString()}</span> : null}
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="panel">
        <h2>All vehicles</h2>
        {!rows ? (
          <p className="hint">Loading…</p>
        ) : (
          <div className="fleet-list">
            {rows.map((r) => (
              <button
                key={r.vehicle_code}
                type="button"
                className="fleet-row"
                style={{ width: "100%", textAlign: "left", background: "none", border: "0", cursor: "pointer" }}
                onClick={() => openVehicle(r.vehicle_code)}
              >
                <span className={"pulse " + (r.stale ? (r.recorded_at ? "stale" : "off") : "live")} />
                <b>{r.vehicle_code}</b>
                <span>{r.model || r.type}</span>
                {r.registration ? <span className="badge">{r.registration}</span> : null}
                <span>{r.assigned_driver || "no driver assigned"}</span>
                {r.speed_kph != null ? <span>{Math.round(Number(r.speed_kph))} km/h</span> : null}
                {r.recorded_at ? (
                  <span className="hint">{Math.round(Number(r.minutes_since_ping))} min ago</span>
                ) : (
                  <span className="hint">no GPS yet</span>
                )}
                {r.stale && r.recorded_at ? <span className="badge warn">idle &gt; 30 min</span> : null}
                {!r.recorded_at ? <span className="badge">no signal</span> : null}
                {r.docs_expired ? <span className="badge bad">docs expired</span> : null}
                {r.status !== "Available" ? <span className="badge warn">{r.status}</span> : null}
                <span className="trip-date">{r.job_code || ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {fixes.length ? (
        <div className="map-big" style={{ height: 420 }}>
          <iframe
            title="Fleet map"
            width="100%"
            height="100%"
            frameBorder="0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join(",")}&layer=mapnik&marker=${markers ? fixes[0].lat + "," + fixes[0].lng : ""}`}
          />
        </div>
      ) : (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <p className="hint">
            No live GPS yet. Drivers and riders appear here once they open <b>My job</b> on their phone
            and allow location — position is always ON while on duty.
          </p>
        </div>
      )}

      {selected ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h2>
            {selected} — today&apos;s trail ({history.length} points)
          </h2>
          {history.length ? (
            <div className="tablewrap" style={{ maxHeight: 240, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Position</th>
                    <th>Speed</th>
                    <th>Job</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .slice()
                    .reverse()
                    .slice(0, 60)
                    .map((h, i) => (
                      <tr key={i}>
                        <td>{new Date(h.recorded_at).toLocaleTimeString()}</td>
                        <td>
                          {Number(h.lat).toFixed(5)}, {Number(h.lng).toFixed(5)}
                        </td>
                        <td>{h.speed_kph != null ? Math.round(Number(h.speed_kph)) + " km/h" : "-"}</td>
                        <td>{h.job_code || h.job_type || "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">No movement recorded in the last 12 hours.</p>
          )}
        </div>
      ) : null}
    </>
  );
}