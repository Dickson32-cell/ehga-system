"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Customer auth: sign-in (phone + password) or one-step registration.
 * No SMS OTP (client decision — like Uber): the UNIQUE phone number is the
 * identity guard; a duplicate registration gets "already has an account".
 */
export default function PortalAuthForm({ initialMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
  const [form, setForm] = useState({ full_name: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = mode === "register" ? "/api/portal/auth/register" : "/api/portal/auth/login";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      router.replace("/portal/dashboard");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const register = mode === "register";

  return (
    <div className="login-wrap">
      <div className="login-card portal-auth">
        <div className="wordmark">
          <h1>{register ? "Create your account" : "Welcome back"}</h1>
          <p>EHGA Mobility — Customer Portal</p>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <form onSubmit={submit}>
          {register ? (
            <div className="field">
              <label htmlFor="c-name">Full name *</label>
              <input
                id="c-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                minLength={3}
                autoComplete="name"
              />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="c-phone">Phone number *</label>
            <input
              id="c-phone"
              type="tel"
              placeholder="024 123 4567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              autoComplete="tel"
            />
            {register ? <div className="hint">Your number is your login. Ghana numbers only — one account per number.</div> : null}
          </div>
          <div className="field">
            <label htmlFor="c-pass">Password * {register ? "(min 8 characters)" : ""}</label>
            <input
              id="c-pass"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={register ? 8 : 1}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Please wait..." : register ? "Create account" : "Sign in"}
          </button>
        </form>

        <p style={{ margin: "1.1rem 0 0", fontSize: "0.88rem", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "var(--ink-soft)" }}>
          {register ? (
            <>
              Already registered?{" "}
              <button type="button" className="linklike" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          ) : (
            <>
              New customer?{" "}
              <button type="button" className="linklike" onClick={() => setMode("register")}>
                Sign up
              </button>
            </>
          )}
        </p>

        <p className="portal-auth-note">
          By continuing you agree that your trip details are stored securely and shown to you only.{" "}
          <Link href="/portal">Back to home</Link>
        </p>
      </div>
    </div>
  );
}