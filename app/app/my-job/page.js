import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import JobClient from "./JobClient";

export const dynamic = "force-dynamic";

/**
 * My Job is the field-staff phone page (drivers & riders): assignment, GPS
 * sharing, departure sign-off. Office roles have no "own job" here — send
 * them to the dashboard instead of a page of empty states.
 */
export default async function MyJobPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "DRIVER" && session.role !== "RIDER") redirect("/app");
  return <JobClient session={session} />;
}