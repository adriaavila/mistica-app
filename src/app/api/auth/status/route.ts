import { NextResponse } from "next/server";
import {
  createSessionToken,
  isLegacySession,
  SESSION_COOKIE,
  verifyAuth,
} from "@/lib/server/auth";

export async function GET(request: Request) {
  const authed = verifyAuth(request);
  const response = NextResponse.json({ authed });
  if (authed && isLegacySession(request)) {
    response.cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  return response;
}
