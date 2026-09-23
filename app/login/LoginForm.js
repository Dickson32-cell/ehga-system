"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ONE login for everyone. Tries the account against BOTH user tables
 * (staff first, then customers) and routes to the right interface:
 *   staff    -> /app  (role-based dashboard)
 *   customer -> /portal/dashboard (own data only)
 * Neither side can reach the other's interface: sessions are separate
 * cookie types and every page/API re-verifies its own session server-side.
 */
export default function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const id = identifier.trim();

    try {
      // 1) Staff attempt (username format: name.ehga)
      const sRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: id, password }),
      });
      if (sRes.ok) {
        const sj = await sRes.json().catch(() => ({}));
        router.replace(sj?.user?.role === "MANAGING_DIRECTOR" ? "/app" : "/app");
        router.refresh();
        return;
      }
      // Only accept definitive "wrong credentials" as staff-miss; other
      // errors (500 etc.) still let us try the customer path below.
      const staffMiss = sRes.status === 401 || sRes.status === 403 || sRes.status === 404;

      // 2) Customer attempt (phone number)
      const cRes = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: id, password }),
      });
      if (cRes.ok) {
        router.replace("/portal/dashboard");
        router.refresh();
        return;
      }

      if (staffMiss) {
        setError("Incorrect username/phone or password. Staff sign in with their username, customers with their phone number.");
      } else {
        setError("Something went wrong - please try again.");
      }
      setBusy(false);
    } catch {
      setError("Network error - please try again");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="field" style={{ marginBottom: "0.8rem" }}>
        <label htmlFor="username">Username or phone number</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="md.ehga  ·  or  024 123 4567"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="field" style={{ marginBottom: "1rem" }}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Signing in..." : "Sign in"}
      </button>
      <p style={{ marginTop: "0.9rem", fontSize: "0.78rem", color: "var(--ink-faint)", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        Staff use your work username · Customers use your phone number
      </p>
    </form>
  );
}