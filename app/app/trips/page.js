import { getSession } from "@/lib/auth";
import { REGISTERS } from "@/lib/registers";
import { redirect } from "next/navigation";
import RegisterClient from "@/lib/RegisterClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <RegisterClient registerKey="trips" definition={REGISTERS["trips"]} />;
}
