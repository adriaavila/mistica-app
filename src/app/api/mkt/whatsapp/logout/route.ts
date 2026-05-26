import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getWahaStatus, logoutWahaSession } from "@/lib/server/waha";
import { getSessionNameFromJsonRequest, wahaErrorResponse } from "../_utils";

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sessionName: string;
  try {
    sessionName = await getSessionNameFromJsonRequest(request);
  } catch (err) {
    return wahaErrorResponse(err);
  }

  const dryRun = process.env.MKT_DRY_RUN === "true";
  if (dryRun) {
    return NextResponse.json({
      online: true,
      sessions: [{ name: sessionName, status: "STOPPED" }],
      sessionName,
      status: "STOPPED",
      dryRun: true,
    });
  }

  try {
    await logoutWahaSession(sessionName);
    const status = await getWahaStatus(sessionName);
    return NextResponse.json({
      ...status,
      dryRun: false,
    });
  } catch (err) {
    return wahaErrorResponse(err);
  }
}
