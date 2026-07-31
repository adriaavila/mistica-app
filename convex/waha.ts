import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Outbound WhatsApp transport for anything driven by a cron or the scheduler.
 * Interactive session management (QR, status, start, logout) stays in
 * src/lib/server/waha.ts — only sends need to run without a browser.
 */

function config(sessionOverride?: string) {
  const baseUrl = process.env.WAHA_BASE_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.WAHA_API_KEY?.trim();
  const session = process.env.WAHA_SESSION?.trim();
  if (!baseUrl || !apiKey || !session) {
    throw new Error("WAHA_BASE_URL, WAHA_API_KEY and WAHA_SESSION must be set in Convex env");
  }
  return { baseUrl, apiKey, session: sessionOverride?.trim() || session };
}

async function post(path: string, payload: Record<string, unknown>, sessionOverride?: string) {
  const { baseUrl, apiKey, session } = config(sessionOverride);
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ session, ...payload }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Body may carry the reason but can also echo the payload — keep it short.
    throw new Error(`WAHA ${path} failed: ${res.status}`);
  }
  return (await res.json()) as { id?: string };
}

export const sendText = internalAction({
  args: {
    chatId: v.string(),
    text: v.string(),
    id: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    session: v.optional(v.string()),
  },
  handler: async (_ctx, { chatId, text, id, replyTo, session }) => {
    if (process.env.MKT_DRY_RUN === "true") {
      return { id: `dryrun:${Date.now()}`, dryRun: true };
    }
    const res = await post("/api/sendText", { chatId, text, id, reply_to: replyTo }, session);
    return { id: res.id, dryRun: false };
  },
});

export const sendImage = internalAction({
  args: {
    chatId: v.string(),
    imageUrl: v.string(),
    mimetype: v.string(),
    filename: v.optional(v.string()),
    caption: v.optional(v.string()),
    session: v.optional(v.string()),
  },
  handler: async (_ctx, { chatId, imageUrl, mimetype, filename, caption, session }) => {
    if (process.env.MKT_DRY_RUN === "true") {
      return { id: `dryrun:${Date.now()}`, dryRun: true };
    }
    const res = await post("/api/sendImage", {
      chatId,
      file: { mimetype, url: imageUrl, filename: filename ?? "imagen.jpg" },
      caption,
    }, session);
    return { id: res.id, dryRun: false };
  },
});

export const markAsRead = internalAction({
  args: {
    chatId: v.string(),
    messageId: v.string(),
    session: v.optional(v.string()),
  },
  handler: async (_ctx, { chatId, messageId, session }) => {
    await post("/api/sendSeen", { chatId, messageIds: [messageId] }, session);
  },
});
