import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import { redirect } from "next/navigation";
import PortalAuthForm from "./PortalAuthForm";

export const dynamic = "force-dynamic";

export default async function PortalAuthPage({ searchParams }) {
  const session = await getCustomerSession();
  if (session) redirect("/portal/dashboard");
  const params = await searchParams;

  return (
    <div className="login-wrap">
      <PortalAuthForm initialMode={params?.mode === "register" ? "register" : "login"} />
      <p className="portal-stafflink">
        Staff member? <Link href="/login">Operations sign-in</Link>
      </p>
    </div>
  );
}