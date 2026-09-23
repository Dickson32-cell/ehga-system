import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import IncidentsClient from "./IncidentsClient";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <IncidentsClient role={session.role} fullName={session.full_name || session.username} />;
}