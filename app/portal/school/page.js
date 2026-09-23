import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import PortalShell from "../PortalShell";
import SchoolForm from "./SchoolForm";

export const dynamic = "force-dynamic";

export default async function SchoolPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/portal/auth");
  return (
    <PortalShell active="/portal/school" session={session}>
      <SchoolForm />
    </PortalShell>
  );
}