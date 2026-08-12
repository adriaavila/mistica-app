import { verifyAuth } from "@/lib/server/auth";
import { issueConvexToken } from "@/lib/server/convexAuth";

export async function GET(request: Request) {
  if (!verifyAuth(request)) return new Response(null, { status: 401 });
  return Response.json(
    { token: await issueConvexToken() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
