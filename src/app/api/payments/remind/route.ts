import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getSafeWahaError, normalizePhone, resolveWahaSessionName, sendWahaText, maskPhone } from "@/lib/server/waha";

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { phone, message } = body;
    const sessionName = resolveWahaSessionName(body.sessionName || "default");

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Message content is required." }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return NextResponse.json(
        { error: `Invalid Bolivian phone number format: ${maskPhone(phone)}` },
        { status: 400 }
      );
    }

    await sendWahaText({
      phone: normalized,
      message,
      sessionName,
    });

    return NextResponse.json({
      success: true,
      recipient: maskPhone(normalized),
    });
  } catch (err) {
    const safeError = getSafeWahaError(err);
    return NextResponse.json(
      { error: safeError.message, code: safeError.code },
      { status: safeError.status }
    );
  }
}
