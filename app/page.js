import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Root is the customer-facing front door; staff keep their own entry.
  const session = await getSession();
  if (session) redirect("/app");
  redirect("/portal");
}
