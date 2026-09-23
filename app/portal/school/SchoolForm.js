"use client";

import { useState } from "react";
import Link from "next/link";

export default function SchoolForm() {
  const [form, setForm] = useState({
    student_name: "",
    guardian: "",
    guardian_phone: "",
    pickup_address: "",
    school: "",
    am_pickup_time: "",
    pm_pickup_time: "",
  });
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/portal/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Sign-up failed");
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
        <h2>Sign-up received — {done.student_code}</h2>
        <p>
          {done.student_name} · Guardian pickup code:{" "}
          <b className="inline-code" style={{ fontSize: "1.1rem" }}>{done.pickup_code}</b>
        </p>
        <p className="hint">
          <b>Save this code now.</b> Only someone with this code (or an authorized guardian) can pick
          up your child. Staff will confirm the route, car and monthly fee, then activate.
        </p>
        <div className="actions">
          <Link className="btn" href="/portal/dashboard">My school runs</Link>
          <button className="btn secondary" type="button" onClick={() => setDone(null)}>
            Add another child
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>School run sign-up</h1>
          <p className="panel-note">
            Daily school transport with guardian pickup codes and live &quot;child on board / driver
            arriving&quot; alerts. Staff confirm the route and fee after sign-up.
          </p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="panel">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="s-name">Child&apos;s name *</label>
              <input
                id="s-name"
                value={form.student_name}
                onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="s-school">School</label>
              <input
                id="s-school"
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="s-guardian">Guardian name</label>
              <input
                id="s-guardian"
                value={form.guardian}
                onChange={(e) => setForm({ ...form, guardian: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="s-gphone">Guardian phone</label>
              <input
                id="s-gphone"
                type="tel"
                placeholder="024 555 1234"
                value={form.guardian_phone}
                onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="s-pickup">Home pickup address</label>
              <input
                id="s-pickup"
                placeholder="Where should the bus stop?"
                value={form.pickup_address}
                onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="s-am">Preferred AM pickup time</label>
              <input
                id="s-am"
                type="time"
                value={form.am_pickup_time}
                onChange={(e) => setForm({ ...form, am_pickup_time: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="s-pm">Preferred PM return time</label>
              <input
                id="s-pm"
                type="time"
                value={form.pm_pickup_time}
                onChange={(e) => setForm({ ...form, pm_pickup_time: e.target.value })}
              />
            </div>
          </div>

          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Sign up for school run"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}