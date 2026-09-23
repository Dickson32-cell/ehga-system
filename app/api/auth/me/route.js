import { getSession, apiHandler } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session) return Response.json({ user: null }, { status: 401 });
  return Response.json({
    user: { username: session.username, full_name: session.full_name, role: session.role },
  });
});
