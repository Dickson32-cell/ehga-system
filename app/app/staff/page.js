import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StaffClient from "./StaffClient";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "MANAGING_DIRECTOR") redirect("/app");
  return <StaffClient me={session.username} />;
}
