import { NextResponse } from "next/server";
import { getSafeWahaError, resolveWahaSessionName } from "@/lib/server/waha";

export function getSessionNameFromRequest(request: Request): string {
  const url = new URL(request.url);
  return resolveWahaSessionName(url.searchParams.get("sessionName"));
}

export async function getSessionNameFromJsonRequest(request: Request): Promise<string> {
  let body: { sessionName?: string } = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && "sessionName" in parsed) {
      body = { sessionName: String(parsed.sessionName) };
    }
  } catch {
    // Body is optional for WAHA session actions.
  }
  return resolveWahaSessionName(body.sessionName);
}

export function wahaErrorResponse(err: unknown) {
  const safeError = getSafeWahaError(err);
  return NextResponse.json(
    {
      error: safeError.message,
      code: safeError.code,
    },
    { status: safeError.status }
  );
}
