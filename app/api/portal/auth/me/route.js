import { apiHandler } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const session = await getCustomerSession();
  return Response.json({ customer: session });
});