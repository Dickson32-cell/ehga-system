import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import PortalShell from "../PortalShell";
import BookForm from "./BookForm";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/portal/auth");
  return (
    <PortalShell active="/portal/book" session={session}>
      <BookForm />
    </PortalShell>
  );
}