import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import PortalShell from "../PortalShell";
import PortalDashboardClient from "./PortalDashboardClient";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/portal/auth");

  return (
    <PortalShell active="/portal/dashboard" session={session}>
      <PortalDashboardClient session={session} />
    </PortalShell>
  );
}