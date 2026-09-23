import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import PortalShell from "../PortalShell";
import HireForm from "./HireForm";

export const dynamic = "force-dynamic";

export default async function HirePage() {
  const session = await getCustomerSession();
  if (!session) redirect("/portal/auth");
  return (
    <PortalShell active="/portal/hire" session={session}>
      <HireForm />
    </PortalShell>
  );
}