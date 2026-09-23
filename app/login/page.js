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
      </div>
    </div>
  );
}