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
        <div className="login-links">
          <p>
            <Link href="/portal/auth?mode=register" className="ll-strong">
              Create customer account
            </Link>
          </p>
          <p>
            <Link href="/portal/driver-apply" className="ll-strong">
              Drive with us — driver sign-up
            </Link>
          </p>
          <p className="ll-faint">
            Forgot your password? Call the office line to reset it.
          </p>
        </div>
      </div>
    </div>
  );
}