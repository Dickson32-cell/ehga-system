import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="wordmark">
          <h1>EHGA Mobility</h1>
          <p>Operations System - Staff Access</p>
        </div>
        <LoginForm />
        <p style={{ marginTop: "1.2rem", fontSize: "0.8rem", color: "var(--ink-faint)", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          Accounts are issued by the Managing Director. Access is logged and role-restricted.
        </p>
      </div>
    </div>
  );
}
