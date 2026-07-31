import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyHmacSha512 } from "./lib/hmac";

const http = httpRouter();

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

http.route({
  path: "/waha/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Raw body first — HMAC covers these exact bytes.
    const raw = await request.text();
    const signature = request.headers.get("x-webhook-hmac");
    const secret = process.env.WAHA_WEBHOOK_HMAC_KEY;

    if (!secret) {
      console.error("[waha] WAHA_WEBHOOK_HMAC_KEY is not set; rejecting webhook");
      return new Response("not configured", { status: 503 });
    }
    if (!signature || !(await verifyHmacSha512(raw, signature, secret))) {
      return new Response("unauthorized", { status: 401 });
    }

    let body: { id?: string; event?: string; session?: string; payload?: Record<string, unknown> };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("bad request", { status: 400 });
    }

    if (!body.event || !body.session) return new Response("bad request", { status: 400 });

    const requestId = request.headers.get("x-webhook-request-id")
      ?? request.headers.get("x-request-id")
      ?? undefined;
    const payloadId = body.payload?.id;
    const eventId = requestId
      ?? body.id
      ?? (typeof payloadId === "string" ? payloadId : await sha256(raw));
    const recorded = await ctx.runMutation(internal.whatsapp.recordAuthenticatedEvent, {
      sessionId: body.session,
      eventType: body.event,
      providerEventId: `${body.event}:${eventId}`,
      requestId,
      payload: body.payload ?? {},
    });

    // The WAHA instance is shared. Authenticated events for sessions not owned
    // by this pilot are intentionally ignored without leaking tenant details.
    return new Response(null, { status: recorded ? 202 : 204 });
  }),
});

export default http;
