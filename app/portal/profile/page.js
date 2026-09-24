import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import PortalShell from "../PortalShell";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getCustomerSession();
  if (!session) redirect("/portal/auth");

  return (
    <PortalShell active="/portal/profile" session={session}>
      <ProfileClient session={session} />
    </PortalShell>
  );
}