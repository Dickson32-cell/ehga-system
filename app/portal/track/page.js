import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import PortalShell from "../PortalShell";
import TrackClient from "./TrackClient";

export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }) {
  const session = await getCustomerSession();
  if (!session) redirect("/portal/auth");
  const params = await searchParams;

  return (
    <PortalShell active="/portal/track" session={session}>
      <TrackClient focusCode={params?.code || null} />
    </PortalShell>
  );
}