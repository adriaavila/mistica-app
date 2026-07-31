import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const PILOT_WORKSPACE = "mistica";

export const recordAuthenticatedEvent = internalMutation({
  args: {
    sessionId: v.string(),
    eventType: v.string(),
    providerEventId: v.string(),
    requestId: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    let connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_wahaSessionId", (q) => q.eq("wahaSessionId", args.sessionId))
      .unique();

    // Mística is the one-tenant pilot. Do not claim a session owned by another
    // app sharing this WAHA instance.
    const configuredSession = process.env.WAHA_SESSION?.trim() || "default";
    if (!connection && args.sessionId !== configuredSession) return null;

    const now = Date.now();
    if (!connection) {
      const id = await ctx.db.insert("whatsappConnections", {
        connectionId: crypto.randomUUID(),
        provider: "waha",
        workspaceKey: process.env.WHATSAPP_WORKSPACE_KEY?.trim() || PILOT_WORKSPACE,
        wahaSessionId: args.sessionId,
        status: "UNKNOWN",
        lastWebhookAt: now,
        createdAt: now,
        updatedAt: now,
      });
      connection = (await ctx.db.get(id))!;
    } else {
      await ctx.db.patch(connection._id, { lastWebhookAt: now, updatedAt: now });
    }

    const existing = await ctx.db
      .query("whatsappRawEvents")
      .withIndex("by_connection_event", (q) =>
        q.eq("connectionId", connection.connectionId).eq("providerEventId", args.providerEventId)
      )
      .unique();
    if (existing) return { rawEventId: existing._id, duplicate: true };

    const rawEventId = await ctx.db.insert("whatsappRawEvents", {
      connectionId: connection.connectionId,
      providerEventId: args.providerEventId,
      requestId: args.requestId,
      eventType: args.eventType,
      payload: args.payload,
      status: "PENDING",
      attempts: 0,
      receivedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.whatsapp.processRawEvent, { rawEventId });
    return { rawEventId, duplicate: false };
  },
});

export const claimRawEvent = internalMutation({
  args: { rawEventId: v.id("whatsappRawEvents") },
  handler: async (ctx, { rawEventId }) => {
    const event = await ctx.db.get(rawEventId);
    if (!event || event.status === "PROCESSED" || event.status === "SKIPPED") return null;
    if (!event.connectionId) throw new Error("Raw event has no connection");
    await ctx.db.patch(rawEventId, {
      status: "PROCESSING",
      attempts: event.attempts + 1,
      error: undefined,
    });
    return event;
  },
});

export const finishRawEvent = internalMutation({
  args: {
    rawEventId: v.id("whatsappRawEvents"),
    status: v.union(v.literal("PROCESSED"), v.literal("FAILED"), v.literal("SKIPPED")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { rawEventId, status, error }) => {
    await ctx.db.patch(rawEventId, {
      status,
      error,
      processedAt: Date.now(),
    });
  },
});

export const updateConnectionStatus = internalMutation({
  args: { connectionId: v.string(), payload: v.any() },
  handler: async (ctx, { connectionId, payload }) => {
    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_connectionId", (q) => q.eq("connectionId", connectionId))
      .unique();
    if (!connection) return;

    const now = Date.now();
    const status = String(payload?.status ?? payload?.state ?? "UNKNOWN").toUpperCase();
    const rawPhone = payload?.me?.id ?? payload?.me?.user ?? payload?.phone;
    const phone = typeof rawPhone === "string" ? rawPhone.replace(/@.*$/, "") : undefined;
    const connected = status === "WORKING" || status === "CONNECTED";
    const disconnected = ["STOPPED", "FAILED", "DISCONNECTED"].includes(status);
    const error = payload?.error ?? payload?.reason;

    await ctx.db.patch(connection._id, {
      status,
      ...(phone ? { phone } : {}),
      ...(connected ? { connectedAt: connection.connectedAt ?? now, disconnectedAt: undefined, lastError: undefined } : {}),
      ...(disconnected ? { disconnectedAt: now } : {}),
      ...(error ? { lastError: String(error) } : {}),
      updatedAt: now,
    });
  },
});

export const noteConnectionActivity = internalMutation({
  args: {
    connectionId: v.string(),
    direction: v.union(v.literal("in"), v.literal("out")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { connectionId, direction, error }) => {
    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_connectionId", (q) => q.eq("connectionId", connectionId))
      .unique();
    if (!connection) return;
    const now = Date.now();
    await ctx.db.patch(connection._id, {
      ...(direction === "in" ? { lastInboundAt: now } : { lastOutboundAt: now }),
      ...(error ? { lastError: error } : {}),
      updatedAt: now,
    });
  },
});

export const processRawEvent = internalAction({
  args: { rawEventId: v.id("whatsappRawEvents") },
  handler: async (ctx, { rawEventId }) => {
    const event = await ctx.runMutation(internal.whatsapp.claimRawEvent, { rawEventId });
    if (!event?.connectionId) return;

    try {
      switch (event.eventType) {
        case "message":
          const ingested = await ctx.runMutation(internal.crm.ingestInbound, {
            connectionId: event.connectionId,
            payload: event.payload,
          });
          if (ingested && !ingested.fromMe) {
            await ctx.runAction(internal.agent.maybeReply, { messageId: ingested.messageId });
          }
          break;
        case "message.ack":
          await ctx.runMutation(internal.crm.updateAck, {
            connectionId: event.connectionId,
            payload: event.payload,
          });
          break;
        case "session.status":
          await ctx.runMutation(internal.whatsapp.updateConnectionStatus, {
            connectionId: event.connectionId,
            payload: event.payload,
          });
          break;
        default:
          await ctx.runMutation(internal.whatsapp.finishRawEvent, {
            rawEventId,
            status: "SKIPPED",
          });
          return;
      }
      await ctx.runMutation(internal.whatsapp.finishRawEvent, {
        rawEventId,
        status: "PROCESSED",
      });
    } catch (error) {
      await ctx.runMutation(internal.whatsapp.finishRawEvent, {
        rawEventId,
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : "Processing failed",
      });
    }
  },
});

export const listConnections = query({
  args: {},
  handler: (ctx) => ctx.db.query("whatsappConnections").collect(),
});
