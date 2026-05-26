import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getWahaDebugInfo } from "@/lib/server/waha";
import { getSessionNameFromRequest, wahaErrorResponse } from "../_utils";

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionName = getSessionNameFromRequest(request);
    const debug = await getWahaDebugInfo(sessionName);
    return NextResponse.json(debug);
  } catch (err) {
    return wahaErrorResponse(err);
  }
}
