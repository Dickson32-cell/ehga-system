import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import JobClient from "./JobClient";

export const dynamic = "force-dynamic";

export default async function MyJobPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <JobClient session={session} />;
}