import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import MomoClient from "./MomoClient";

export const dynamic = "force-dynamic";

export default async function MomoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const allowed = ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "ACCOUNTANT"].includes(session.role);
  if (!allowed) redirect("/app");
  return <MomoClient />;
}