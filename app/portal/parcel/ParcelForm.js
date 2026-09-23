"use client";

import { useState } from "react";
import Link from "next/link";

const SIZES = [
  ["Envelope", "Documents", "GHS 10"],
  ["Small", "Shoebox", "GHS 20"],
  ["Medium", "Suitcase", "GHS 32"],
  ["Large", "Two boxes", "GHS 48"],
  ["XL", "Bulk / cargo", "GHS 70"],
];

export default function ParcelForm() {
  const [form, setForm] = useState({
    recipient: "",
    recipient_phone: "",
    pickup_address: "",
    delivery_address: "",
    description: "",
    size: "Small",
  });
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/portal/parcels", {
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
        <h2>Parcel booked — {done.parcel_code}</h2>
        <p>
          {done.sender} → {done.recipient} · {done.size} ·{" "}
          <b>GHS {Number(done.total_charge).toFixed(2)}</b>
        </p>
        <p className="hint">
          A rider will collect from your pickup address. Watch it move on the map from{" "}
          <Link href="/portal/track">Track</Link>.
        </p>
        <div className="actions">
          {done.whatsapp_url ? (
            <a className="btn secondary" href={done.whatsapp_url} target="_blank" rel="noreferrer">
              Send on WhatsApp
            </a>
          ) : null}
          <Link className="btn" href="/portal/dashboard">My parcels</Link>
          <button className="btn secondary" type="button" onClick={() => setDone(null)}>
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Send a parcel</h1>
          <p className="panel-note">
            Pickup + delivery each GHS 10; size charge on top. Proof of delivery comes to your phone.
          </p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="panel">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="p-rec">Recipient name *</label>
              <input
                id="p-rec"
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="p-phone">Recipient phone</label>
              <input
                id="p-phone"
                type="tel"
                placeholder="024 987 6543"
                value={form.recipient_phone}
                onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="p-size">Size *</label>
              <select id="p-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
                {SIZES.map(([s, hint]) => (
                  <option key={s} value={s}>
                    {s} — {hint}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="p-pickup">Pickup address *</label>
              <input
                id="p-pickup"
                placeholder="Where should we collect it?"
                value={form.pickup_address}
                onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="p-deliver">Delivery address *</label>
              <input
                id="p-deliver"
                placeholder="Where is it going?"
                value={form.delivery_address}
                onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="p-desc">What is in it? (description)</label>
              <textarea
                id="p-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div className="panel-note" style={{ margin: "0.8rem 0" }}>
            Charges: size charge + GHS 10 pickup + GHS 10 delivery. Total shows before you confirm on
            the next screen.
          </div>

          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Book parcel pickup"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}