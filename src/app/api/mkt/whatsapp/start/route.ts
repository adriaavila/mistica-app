import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { startWahaSession, getWahaStatus } from "@/lib/server/waha";

export async function POST(request: Request) {
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

  try {
    await startWahaSession("default");
    const status = await getWahaStatus();
    return NextResponse.json({
      ...status,
      dryRun: false,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
