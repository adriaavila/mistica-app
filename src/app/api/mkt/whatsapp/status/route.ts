import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getWahaStatus } from "@/lib/server/waha";

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = process.env.MKT_DRY_RUN === "true";
  if (dryRun) {
    return NextResponse.json({
      online: true,
      sessions: [{ name: "default", status: "WORKING" }],
      dryRun: true,
    });
  }

  const status = await getWahaStatus();
  return NextResponse.json({
    ...status,
    dryRun: false,
  });
}
