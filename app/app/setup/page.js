import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SetupClient from "./SetupClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const canEdit = session.role === "MANAGING_DIRECTOR" || session.role === "OPERATIONS_MANAGER";
  return <SetupClient canEdit={canEdit} />;
}
