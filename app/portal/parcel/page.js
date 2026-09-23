import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import PortalShell from "../PortalShell";
import ParcelForm from "./ParcelForm";

export const dynamic = "force-dynamic";

export default async function ParcelPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/portal/auth");
  return (
    <PortalShell active="/portal/parcel" session={session}>
      <ParcelForm />
    </PortalShell>
  );
}