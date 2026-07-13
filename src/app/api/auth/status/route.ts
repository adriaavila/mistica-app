import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(request: Request) {
  return NextResponse.json({ authed: verifyAuth(request) });
}
