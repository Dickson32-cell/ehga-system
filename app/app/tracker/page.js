import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrackerClient from "./TrackerClient";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TrackerClient role={session.role} />;
}