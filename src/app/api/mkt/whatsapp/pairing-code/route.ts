import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { requestWahaPairingCode, resolveWahaSessionName } from "@/lib/server/waha";
import { wahaErrorResponse } from "../_utils";

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { phoneNumber?: unknown; sessionName?: string } = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as typeof body;
    }
  } catch {
    // Validation below returns the user-facing input error.
  }

  let sessionName: string;
  try {
    sessionName = resolveWahaSessionName(typeof body.sessionName === "string" ? body.sessionName : null);
  } catch (err) {
    return wahaErrorResponse(err);
  }

  if (process.env.MKT_DRY_RUN === "true") {
    return NextResponse.json({
      code: "DRY-RUN",
      sessionName,
      message: "Modo simulación: no se solicitó ningún código a WhatsApp.",
      dryRun: true,
    });
  }

  try {
    const result = await requestWahaPairingCode(String(body.phoneNumber ?? ""), sessionName);
    return NextResponse.json({ ...result, dryRun: false });
  } catch (err) {
    return wahaErrorResponse(err);
  }
}
