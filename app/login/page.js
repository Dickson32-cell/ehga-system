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
          <p>Sign in</p>
        </div>
        <LoginForm />
        <p style={{ margin: "1rem 0 0", fontSize: "0.86rem", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "var(--ink-soft)" }}>
          New customer?{" "}
          <Link href="/portal/auth?mode=register" style={{ color: "var(--good)", fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}