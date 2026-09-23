import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StaffClient from "./StaffClient";

export const dynamic = "force-dynamic";

// Who may open the Staff page:
//   MANAGING_DIRECTOR (CEO) — full control: sees all staff, adds/edits/deletes anyone,
//   including HR, Operations Managers and Accountants.
//   HR — adds and manages Drivers and Dispatch Riders only (field recruitment).
// Operations Manager runs operations + fuel; Accountant runs deposits — neither
// manages staff. Everyone else is redirected to the dashboard.
export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["MANAGING_DIRECTOR", "HR"].includes(session.role)) redirect("/app");
  return <StaffClient
    me={{ id: session.sub, username: session.username }}
    myRole={session.role}
  />;
}