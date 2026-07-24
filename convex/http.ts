import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyHmacSha512 } from "./lib/hmac";

const http = httpRouter();

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

    let body: { event?: string; session?: string; payload?: Record<string, unknown> };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("bad request", { status: 400 });
    }

    // WAHA is shared with another tenant; ignore anything that is not our session.
    if (body.session !== process.env.WAHA_SESSION) {
      return new Response(null, { status: 200 });
    }

    switch (body.event) {
      case "message":
        await ctx.runMutation(internal.crm.ingestInbound, { payload: body.payload ?? {} });
        break;
      case "message.ack":
        await ctx.runMutation(internal.crm.updateAck, { payload: body.payload ?? {} });
        break;
      case "session.status":
        console.log("[waha] session.status", JSON.stringify(body.payload));
        break;
    }

    // Always 200 on an authenticated, understood webhook so WAHA stops retrying.
    return new Response(null, { status: 200 });
  }),
});

export default http;
