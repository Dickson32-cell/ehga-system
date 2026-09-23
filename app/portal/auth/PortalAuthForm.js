"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Customer auth: sign-in (phone + password) or two-step registration.
 * Registration step 1 collects details and sends a ONE-TIME SMS code;
 * step 2 verifies the code and creates the account.
 */
export default function PortalAuthForm({ initialMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
  const [step, setStep] = useState("details"); // registration: details | verify
  const [form, setForm] = useState({ full_name: "", phone: "", password: "", code: "" });
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      if (mode === "login") {
        await post("/api/portal/auth/login", { phone: form.phone, password: form.password });
        router.replace("/portal/dashboard");
        return;
      }
      if (step === "details") {
        const j = await post("/api/portal/auth/register", {
          full_name: form.full_name,
          phone: form.phone,
        });
        setOkMsg(j.message);
        setStep("verify");
      } else {
        await post("/api/portal/auth/verify", {
          full_name: form.full_name,
          phone: form.phone,
          code: form.code,
          password: form.password,
        });
        router.replace("/portal/dashboard");
        return;
      }
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function resendCode() {
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const j = await post("/api/portal/auth/register", {
        full_name: form.full_name,
        phone: form.phone,
      });
      setOkMsg(j.message + " (Your previous code is no longer valid.)");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  const register = mode === "register";

  return (
    <div className="login-wrap">
      <div className="login-card portal-auth">
        <div className="wordmark">
          <h1>{register ? (step === "verify" ? "Check your phone" : "Create your account") : "Welcome back"}</h1>
          <p>EHGA Mobility — Customer Portal</p>
        </div>

        {error ? <div className="form-error">{error}</div> : null}
        {okMsg ? <div className="form-ok">{okMsg}</div> : null}

        <form onSubmit={submit}>
          {register && step === "details" ? (
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
              disabled={register && step === "verify"}
            />
            {register && step === "details" ? (
              <div className="hint">Your number is your login. Ghana numbers only. We will text you a one-time code to confirm it.</div>
            ) : null}
          </div>

          {register && step === "verify" ? (
            <>
              <div className="field">
                <label htmlFor="c-code">6-digit code from the SMS *</label>
                <input
                  id="c-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  autoComplete="one-time-code"
                  style={{ letterSpacing: "0.4em", fontSize: "1.15rem" }}
                />
                <div className="hint">
                  The code expires in 10 minutes and can be used ONCE. SMS can take up to
                  5 minutes to arrive — please wait before resending, because requesting
                  again cancels the first code.
                </div>
              </div>
              <div className="field">
                <label htmlFor="c-pass">Choose a password * (min 8 characters)</label>
                <input
                  id="c-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </>
          ) : null}

          {!register ? (
            <div className="field">
              <label htmlFor="c-pass">Password *</label>
              <input
                id="c-pass"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
            </div>
          ) : null}

          <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy
              ? "Please wait..."
              : register
                ? step === "details"
                  ? "Send me the code"
                  : "Verify and create account"
                : "Sign in"}
          </button>
        </form>

        {register && step === "verify" ? (
          <p style={{ margin: "0.8rem 0 0", fontSize: "0.88rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
            Didn&apos;t get it?{" "}
            <button type="button" className="linklike" disabled={busy} onClick={resendCode}>
              Resend code
            </button>{" "}
            — requesting again cancels the first code.{" "}
            <button type="button" className="linklike" onClick={() => { setStep("details"); setError(""); setOkMsg(""); }}>
              Change number
            </button>
          </p>
        ) : null}

        {register && step === "details" ? (
          <p style={{ margin: "1.1rem 0 0", fontSize: "0.88rem", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "var(--ink-soft)" }}>
            Already registered?{" "}
            <button type="button" className="linklike" onClick={() => setMode("login")}>
              Sign in
            </button>
          </p>
        ) : null}
        {!register ? (
          <p style={{ margin: "1.1rem 0 0", fontSize: "0.88rem", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "var(--ink-soft)" }}>
            New customer?{" "}
            <button type="button" className="linklike" onClick={() => setMode("register")}>
              Sign up
            </button>
          </p>
        ) : null}

        <p className="portal-auth-note">
          By continuing you agree that your trip details are stored securely and shown to you only.{" "}
          <Link href="/portal">Back to home</Link>
        </p>
      </div>
    </div>
  );
}