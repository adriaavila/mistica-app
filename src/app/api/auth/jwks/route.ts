export async function GET() {
  const key = process.env.CONVEX_AUTH_PUBLIC_JWK;
  if (!key) return new Response(null, { status: 503 });
  return Response.json(
    { keys: [{ ...JSON.parse(key), kid: "mistica-admin-v1", use: "sig", alg: "RS256" }] },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
