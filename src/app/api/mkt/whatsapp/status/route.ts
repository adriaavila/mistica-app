import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getWahaStatus } from "@/lib/server/waha";
import { getSessionNameFromRequest, wahaErrorResponse } from "../_utils";

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sessionName: string;
  try {
    sessionName = getSessionNameFromRequest(request);
  } catch (err) {
    return wahaErrorResponse(err);
  }

  const dryRun = process.env.MKT_DRY_RUN === "true";
  if (dryRun) {
    return NextResponse.json({
      online: true,
      sessions: [{ name: sessionName, status: "WORKING" }],
      sessionName,
      status: "WORKING",
      dryRun: true,
    });
  }

  const status = await getWahaStatus(sessionName);
  return NextResponse.json({
    ...status,
    dryRun: false,
  });
}
