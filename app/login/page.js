import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Go straight to the right interface.
  const staff = await getSession();
  if (staff) redirect("/app");
  const customer = await getCustomerSession();
  if (customer) redirect("/portal/dashboard");

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="wordmark">
          <h1>EHGA Mobility</h1>
          <p>One account · Staff &amp; Customers</p>
        </div>
        <LoginForm />
        <p style={{ marginTop: "1.2rem", fontSize: "0.78rem", color: "var(--ink-faint)", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          New customer? <Link href="/portal/auth?mode=register">Create an account</Link> · Staff
          accounts are issued by the Managing Director.
        </p>
      </div>
    </div>
  );
}