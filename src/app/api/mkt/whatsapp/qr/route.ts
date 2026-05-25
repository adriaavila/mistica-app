import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getWahaQr } from "@/lib/server/waha";

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const qr = await getWahaQr("default");
    return NextResponse.json({ qr });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
