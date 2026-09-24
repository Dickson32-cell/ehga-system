"use client";

import { useEffect, useState } from "react";
import useAutoRefresh from "@/lib/useAutoRefresh";

const DEFAULT_FROM = "2026-10-01";
const DEFAULT_TO = "2026-12-31";

function fmtMoney(v) {
  const n = Number(v);
  if (!isFinite(n)) return "0.00";
  return n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtResult(m) {
  if (m.unit === "GHS") return "GHS " + fmtMoney(m.result);
  if (m.unit === "ratio") return (Number(m.result) * 100).toFixed(1) + "%";
  return String(m.result);
}

function fmtTarget(m) {
  if (m.target === null || m.target === undefined) return "-";
  if (m.unit === "ratio") return (Number(m.target) * 100).toFixed(0) + "%";
  if (m.unit === "GHS/km") return "GHS " + Number(m.target).toFixed(2);
  if (m.unit === "GHS") return "GHS " + fmtMoney(m.target);
  return String(m.target);
}

export default function DashboardClient() {
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(f, t) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard?from=${f}&to=${t}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load");
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load(DEFAULT_FROM, DEFAULT_TO);
  }, []);

  // Live board: refresh every 20 s (skipped while the user picks a period).
  useAutoRefresh(() => load(from, to), 20000);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Operations Dashboard</h1>
          <p>
            Live performance of passenger bookings, parcels, private hire, school transport, trips,
            fuel and cash against operating targets. All figures come from recorded rows only.
          </p>
        </div>
        <form
          className="actions"
          style={{ marginTop: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            load(from, to);
          }}
        >
          <div className="field">
            <label htmlFor="from">Period from</label>
            <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Loading..." : "Apply period"}
          </button>
        </form>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {data ? (
        <>
          <p className="panel-note" style={{ marginBottom: "0.8rem" }}>
            Reporting period {data.period.from} to {data.period.to}. Generated{" "}
            {new Date(data.generated_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })} (GMT).
          </p>
          <div className="grid grid-4">
            {data.metrics.map((m) => (
              <div key={m.key} className={"metric " + (m.status === "On target" ? "on" : m.status === "Below target" ? "below" : "neutral")}>
                <div className="m-label">{m.label}</div>
                <div className="m-result">{fmtResult(m)}</div>
                <div className="m-row">
                  <span>
                    Target: <b>{fmtTarget(m)}</b>
                  </span>
                  <span
                    className={
                      "m-status " + (m.status === "On target" ? "on" : m.status === "Below target" ? "below" : "neutral")
                    }
                  >
                    {m.status}
                  </span>
                </div>
                <div className="m-row" style={{ color: "var(--ink-faint)" }}>{m.detail}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="panel-note">{busy ? "Loading metrics..." : "No data loaded."}</p>
      )}
    </>
  );
}
