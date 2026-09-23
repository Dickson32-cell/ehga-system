import { apiHandler } from "@/lib/auth";
import { CUSTOMER_COOKIE } from "@/lib/customer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async () => {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${CUSTOMER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
  return res;
});