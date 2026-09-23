import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StaffClient from "./StaffClient";

export const dynamic = "force-dynamic";

// Who may open the Staff page:
//   MANAGING_DIRECTOR (CEO) — full control: sees all staff, adds/edits/deletes anyone.
//   OPERATIONS_MANAGER — may add and manage drivers and riders only (delegation).
// Everyone else is redirected to the dashboard.
export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["MANAGING_DIRECTOR", "OPERATIONS_MANAGER"].includes(session.role)) redirect("/app");
  return <StaffClient
    me={{ id: session.sub, username: session.username }}
    myRole={session.role}
  />;
}