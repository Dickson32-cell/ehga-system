import { SESSION_COOKIE, apiHandler } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = apiHandler(async () => {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
});

export const GET = POST;
