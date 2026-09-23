"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_BADGE = {
  Pending: "warn",
  Confirmed: "ok",
  Boarded: "ok",
  Completed: "ok",
  Cancelled: "bad",
  "No show": "bad",
  Booked: "warn",
  Collected: "ok",
  "At hub": "ok",
  "In transit": "ok",
  "Out for delivery": "ok",
  Delivered: "ok",
  Failed: "bad",
  Returned: "bad",
  Inquiry: "warn",
  "In progress": "ok",
};

function money(v) {
  return "GHS " + Number(v || 0).toFixed(2);
}

function Stars({ value }) {
  return (
    <span className="stars" aria-label={value + " of 5"}>
      {"★".repeat(value)}
      {"☆".repeat(5 - value)}
    </span>
  );
}

function CarLine({ row }) {
  if (!row.vehicle_model && !row.vehicle_registration) return <span className="hint">Car assigned soon</span>;
  return (
    <span className="carline">
      🚗 {row.vehicle_model || row.vehicle_code} · {row.vehicle_color} ·{" "}
      <b>{row.vehicle_registration}</b>
    </span>
  );
}

function RateBox({ subjectType, code, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!rating) return;
    setBusy(true);
    try {
      const res = await fetch("/api/portal/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_type: subjectType, code, rating, comment }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not save rating");
      setMsg("Thanks for rating!");
      onDone && onDone();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ratebox">
      <span>Rate:</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={"star" + (n <= rating ? " on" : "")}
          onClick={() => setRating(n)}
          disabled={busy}
          aria-label={n + " stars"}
        >
          ★
        </button>
      ))}
      <input
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={busy}
      />
      <button className="btn small" type="button" onClick={send} disabled={busy || !rating}>
        Send
      </button>
      {msg ? <span className="hint">{msg}</span> : null}
    </div>
  );
}

export default function PortalDashboardClient({ session }) {
  const [tab, setTab] = useState("bookings");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rated, setRated] = useState({});

  useEffect(() => {
    const url =
      tab === "bookings"
        ? "/api/portal/bookings"
        : tab === "parcels"
          ? "/api/portal/parcels"
          : tab === "hires"
            ? "/api/portal/private-hire"
            : "/api/portal/school";
    setLoading(true);
    setError("");
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setRows(j.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  const codeField = {
    bookings: "booking_code",
    parcels: "parcel_code",
    hires: "hire_code",
    school: "student_code",
  }[tab];
  const subjectType = { bookings: "BOOKING", parcels: "PARCEL", hires: "PRIVATE_HIRE", school: "SCHOOL" }[tab];

  function payBtn(row) {
    if (!(Number(row.balance) > 0)) return null;
    if (tab === "school" && !row.active_status) return null;
    return (
      <PayButton subjectType={subjectType} code={row[codeField]} amount={row.balance} />
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hello, {session.full_name.split(" ")[0]}</h1>
          <p className="panel-note">
            All YOUR bookings in one place. Every list shows only records created on your phone number.
          </p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link className="btn" href="/portal/book">New booking</Link>
          <Link className="btn secondary" href="/portal/parcel">Send parcel</Link>
        </div>
      </div>

      <div className="mode-tabs left" role="tablist">
        <button type="button" className={tab === "bookings" ? "active" : ""} onClick={() => setTab("bookings")}>
          Seats ({tab === "bookings" ? rows.length : ""})
        </button>
        <button type="button" className={tab === "parcels" ? "active" : ""} onClick={() => setTab("parcels")}>
          Parcels
        </button>
        <button type="button" className={tab === "hires" ? "active" : ""} onClick={() => setTab("hires")}>
          Private hire
        </button>
        <button type="button" className={tab === "school" ? "active" : ""} onClick={() => setTab("school")}>
          School run
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="portal-list">
        {loading ? <p className="hint">Loading…</p> : null}
        {!loading && !rows.length ? (
          <div className="panel">
            <p>Nothing here yet. Use <b>New booking</b> or <b>Send parcel</b> above to get started.</p>
          </div>
        ) : null}
        {rows.map((row) => {
          const code = row[codeField];
          const completed =
            row.status === "Completed" || row.status === "Delivered" || (tab === "school" && !row.active_status);
          return (
            <div className="panel trip-card" key={code}>
              <div className="trip-head">
                <span className="badge code">{code}</span>
                <span className={"badge " + (STATUS_BADGE[row.status] || "")}>{row.status}</span>
                <span className="trip-date">
                  {row.travel_date || row.booking_date || row.service_date || ""}
                  {row.departure_time ? " · " + row.departure_time : ""}
                </span>
              </div>

              {tab === "bookings" ? (
                <>
                  <h3>{row.direction}</h3>
                  <p>
                    {row.seats} seat(s) · {money(row.fare_per_seat)} each · Paid {money(row.amount_paid)} ·
                    Balance <b>{money(row.balance)}</b>
                  </p>
                  <p className="hint">
                    {row.pickup_point || "Pickup point TBA"} → {row.dropoff_point || "Drop-off TBA"}
                  </p>
                </>
              ) : null}

              {tab === "parcels" ? (
                <>
                  <h3>
                    {row.sender} → {row.recipient}
                  </h3>
                  <p>
                    {row.size} · {money(row.total_charge)} · Paid {money(row.amount_paid)} · Balance{" "}
                    <b>{money(row.balance)}</b>
                  </p>
                  <p className="hint">
                    {row.pickup_address} → {row.delivery_address}
                  </p>
                  {row.proof_of_delivery ? <p className="hint">POD: {row.proof_of_delivery}</p> : null}
                </>
              ) : null}

              {tab === "hires" ? (
                <>
                  <h3>{row.service_type}</h3>
                  <p>
                    {row.pickup} → {row.destination}
                  </p>
                  <p>
                    Quote <b>{money(row.quoted_amount)}</b>
                    {row.quote_status === "Auto" ? " (auto-quoted — awaiting confirmation)" : ""} · Paid{" "}
                    {money(row.amount_paid)} · Balance <b>{money(row.balance)}</b>
                  </p>
                </>
              ) : null}

              {tab === "school" ? (
                <>
                  <h3>{row.student_name}</h3>
                  <p>
                    {row.school || "School TBA"} · Fee <b>{money(row.monthly_fee)}</b> · Paid{" "}
                    {money(row.amount_paid)} · Balance <b>{money(row.balance)}</b>
                  </p>
                  <p className="hint">
                    Guardian pickup code: <b className="inline-code">{row.pickup_code}</b> ·{" "}
                    {row.active_status ? "Active on route" : "Awaiting staff activation"}
                  </p>
                </>
              ) : null}

              <div className="trip-meta">
                <CarLine row={row} />
                {row.vehicle_code ? (
                  <Link className="btn small secondary" href={`/portal/track?code=${encodeURIComponent(code)}`}>
                    Track
                  </Link>
                ) : null}
              </div>

              <div className="trip-actions">
                {payBtn(row)}
                {completed ? (
                  rated[code] ? (
                    <span className="hint">You rated this {rated[code]}★ — thank you!</span>
                  ) : (
                    <RateBox subjectType={subjectType} code={code} onDone={() => setRated((r) => ({ ...r, [code]: 5 }))} />
                  )
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PayButton({ subjectType, code, amount }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [payTo, setPayTo] = useState(null);
  const [copied, setCopied] = useState("");

  // Fetch the company's payment MoMo number once, so customers can pay by
  // dialling the USSD string even while the gateway is not yet live.
  useEffect(() => {
    fetch("/api/momo-number")
      .then((r) => r.json())
      .then((j) => {
        if (j.number) setPayTo(j);
      })
      .catch(() => {});
  }, []);

  function ussd() {
    // Kept for a future per-network dial string; the Copy button covers payment for now.
    return `*170#`;
  }

  async function copyNumber() {
    if (!payTo?.number) return;
    try {
      await navigator.clipboard.writeText(payTo.number);
      setCopied("Number copied");
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied(payTo.number);
    }
  }

  async function pay() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/portal/momo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_type: subjectType, code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Payment could not be started");
      if (j.payment_url) {
        window.location.href = j.payment_url;
        return;
      }
      setMsg(j.message || "Payment request queued.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="paybtn">
      <button className="btn small" type="button" onClick={pay} disabled={busy}>
        {busy ? "Starting…" : `Pay MoMo ${money(amount)}`}
      </button>
      {payTo ? (
        <span className="hint">
          Pay to <b>{payTo.number}</b>
          {payTo.payee ? ` (${payTo.payee})` : ""}{" "}
          <button className="btn small secondary" type="button" onClick={copyNumber}>
            {copied || "Copy"}
          </button>
        </span>
      ) : null}
      {msg ? <span className="hint">{msg}</span> : null}
    </span>
  );
}