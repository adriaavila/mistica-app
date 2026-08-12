import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { action, mutation, query } from "./lib/auth";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { normalizePhone, fromChatId, maskPhone } from "./lib/phone";

const PREVIEW_LEN = 80;

function preview(body: string, hasMedia: boolean) {
  if (!body) return hasMedia ? "📷 Imagen" : "";
  return body.length > PREVIEW_LEN ? body.slice(0, PREVIEW_LEN) + "…" : body;
}

/**
 * Match a WhatsApp number against the three phone fields a student can carry.
 * ponytail: full scan — 91 students today. Add a by_phone index on students if
 * this ever shows up in the logs as slow.
 */
async function findStudentsByPhone(ctx: QueryCtx | MutationCtx, normalized: string) {
  const students = await ctx.db.query("students").collect();
  return students.filter((s) =>
    [s.phone, s.payerPhone, s.guardianPhone].some(
      (p) => p && normalizePhone(p) === normalized
    )
  );
}

// --- Inbound ---------------------------------------------------------------

export const ingestInbound = internalMutation({
  args: { connectionId: v.optional(v.string()), payload: v.any() },
  handler: async (ctx, { connectionId, payload }) => {
    const waMessageId: string | undefined = payload?.id;
    if (!waMessageId) return;

    // WAHA retries on any non-2xx, so the same message can arrive several times.
    const fromMe: boolean = payload.fromMe === true;
    const existing = connectionId
      ? await ctx.db
          .query("messages")
          .withIndex("by_connection_waMessageId", (q) =>
            q.eq("connectionId", connectionId).eq("waMessageId", waMessageId)
          )
          .first()
      : await ctx.db
          .query("messages")
          .withIndex("by_waMessageId", (q) => q.eq("waMessageId", waMessageId))
          .first();
    if (existing) {
      // WAHA echoes our stable outbound id. Reconcile the pre-send row instead
      // of inserting a second local/provider copy.
      if (fromMe && existing.direction === "out" && existing.sendStatus === "PENDING") {
        await ctx.db.patch(existing._id, { sendStatus: "SENT", sendError: undefined });
      }
      return;
    }

    const chatId: string = fromMe ? payload.to : payload.from;
    if (!chatId) return;

    // Groups, status broadcasts and channels are not people — drop them.
    const rawPhone = fromChatId(chatId);
    if (!rawPhone) return;

    const normalized = normalizePhone(rawPhone) ?? rawPhone;
    const now = Date.now();
    const body: string = payload.body ?? "";
    const hasMedia: boolean = payload.hasMedia === true;

    // Contact
    let contact = connectionId
      ? await ctx.db
          .query("contacts")
          .withIndex("by_connection_chatId", (q) =>
            q.eq("connectionId", connectionId).eq("waChatId", chatId)
          )
          .first()
      : await ctx.db
          .query("contacts")
          .withIndex("by_chatId", (q) => q.eq("waChatId", chatId))
          .first();

    if (!contact) {
      const students = await findStudentsByPhone(ctx, normalized);
      const pushName: string = payload._data?.notifyName || payload.notifyName || "";
      const contactId = await ctx.db.insert("contacts", {
        connectionId,
        waChatId: chatId,
        normalizedPhone: normalized,
        displayName: pushName || students[0]?.guardianName || students[0]?.name || normalized,
        kind: students.length > 0 ? "cliente" : "interesado",
        linkedStudentIds: students.map((s) => s._id),
        stage: students.length > 0 ? undefined : "nuevo",
        source: "whatsapp_inbound",
        createdAt: now,
        updatedAt: now,
      });
      contact = (await ctx.db.get(contactId))!;
      console.log(
        `[crm] nuevo contacto ${maskPhone(normalized)} (${contact.kind})`
      );
    }

    // Conversation
    let conversation = connectionId
      ? await ctx.db
          .query("conversations")
          .withIndex("by_connection_chatId", (q) =>
            q.eq("connectionId", connectionId).eq("waChatId", chatId)
          )
          .first()
      : await ctx.db
          .query("conversations")
          .withIndex("by_chatId", (q) => q.eq("waChatId", chatId))
          .first();

    if (!conversation) {
      const conversationId = await ctx.db.insert("conversations", {
        connectionId,
        contactId: contact._id,
        waChatId: chatId,
        status: "abierta",
        lastMessageAt: now,
        lastMessagePreview: preview(body, hasMedia),
        lastMessageDirection: fromMe ? "out" : "in",
        unreadCount: 0,
        // Automated sending is intentionally off for this pilot.
        ownershipState: "HUMAN_ACTIVE",
        createdAt: now,
      });
      conversation = (await ctx.db.get(conversationId))!;
    }

    // WAHA timestamps are seconds.
    const timestamp = typeof payload.timestamp === "number" ? payload.timestamp * 1000 : now;

    const messageId = await ctx.db.insert("messages", {
      connectionId,
      conversationId: conversation._id,
      waMessageId,
      direction: fromMe ? "out" : "in",
      authorType: fromMe ? "humano" : "contacto",
      body,
      timestamp,
      hasMedia,
    });

    if (connectionId) {
      const connection = await ctx.db
        .query("whatsappConnections")
        .withIndex("by_connectionId", (q) => q.eq("connectionId", connectionId))
        .unique();
      if (connection) {
        await ctx.db.patch(connection._id, { lastInboundAt: now, updatedAt: now });
      }
    }

    await ctx.db.patch(conversation._id, {
      lastMessageAt: timestamp,
      lastMessagePreview: preview(body, hasMedia),
      lastMessageDirection: fromMe ? "out" : "in",
      status: "abierta",
      ...(fromMe
        ? {}
        : { lastInboundAt: timestamp, unreadCount: conversation.unreadCount + 1 }),
    });

    // media.url is absent when WHATSAPP_DOWNLOAD_MEDIA is off on the WAHA service.
    if (hasMedia) {
      const mediaUrl: string | undefined = payload.media?.url;
      if (mediaUrl) {
        await ctx.scheduler.runAfter(0, internal.wahaMedia.fetchAndStore, {
          messageId,
          mediaUrl,
        });
      } else {
        await ctx.db.patch(messageId, {
          mediaError: payload.media?.error ?? "WAHA no envió el archivo (descarga de medios desactivada)",
        });
      }
    }
    return { messageId, conversationId: conversation._id, fromMe };
  },
});

export const updateAck = internalMutation({
  args: { connectionId: v.optional(v.string()), payload: v.any() },
  handler: async (ctx, { connectionId, payload }) => {
    const waMessageId: string | undefined = payload?.id;
    const ack: number | undefined = payload?.ack;
    if (!waMessageId || typeof ack !== "number") return;

    const message = connectionId
      ? await ctx.db
          .query("messages")
          .withIndex("by_connection_waMessageId", (q) =>
            q.eq("connectionId", connectionId).eq("waMessageId", waMessageId)
          )
          .first()
      : await ctx.db
          .query("messages")
          .withIndex("by_waMessageId", (q) => q.eq("waMessageId", waMessageId))
          .first();
    if (!message) return;

    // Acks can arrive out of order; never move the status backwards.
    if ((message.ack ?? 0) >= ack) return;
    await ctx.db.patch(message._id, { ack, sendStatus: "SENT", sendError: undefined });
  },
});

export const attachMedia = internalMutation({
  args: { messageId: v.id("messages"), storageId: v.id("_storage"), mimeType: v.string() },
  handler: async (ctx, { messageId, storageId, mimeType }) => {
    const message = await ctx.db.get(messageId);
    if (!message) return;

    await ctx.db.patch(messageId, { storageId, mimeType, mediaError: undefined });

    // An inbound image is a comprobante until a human says otherwise.
    if (message.direction === "in" && mimeType.startsWith("image/")) {
      const conversation = await ctx.db.get(message.conversationId);
      if (!conversation) return;
      const contact = await ctx.db.get(conversation.contactId);
      if (!contact) return;

      await ctx.db.insert("receipts", {
        messageId,
        contactId: contact._id,
        storageId,
        status: "pendiente",
        studentId: contact.linkedStudentIds.length === 1 ? contact.linkedStudentIds[0] : undefined,
        receivedAt: message.timestamp,
      });
    }
  },
});

export const setMediaError = internalMutation({
  args: { messageId: v.id("messages"), error: v.string() },
  handler: async (ctx, { messageId, error }) => {
    await ctx.db.patch(messageId, { mediaError: error });
  },
});

// --- Inbox reads -----------------------------------------------------------

export const listConversations = query({
  args: { status: v.optional(v.union(v.literal("abierta"), v.literal("pospuesta"), v.literal("cerrada"))) },
  handler: async (ctx, { status }) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_status_recent", (q) => q.eq("status", status ?? "abierta"))
      .order("desc")
      .take(100);

    return Promise.all(
      conversations.map(async (c) => {
        const contact = await ctx.db.get(c.contactId);
        return {
          ...c,
          contactName: contact?.displayName ?? "",
          contactKind: contact?.kind ?? "otro",
          contactPhone: contact?.normalizedPhone ?? "",
          needsReply: c.lastMessageDirection === "in",
        };
      })
    );
  },
});

export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .take(200);

    return Promise.all(
      messages.map(async (m) => ({
        ...m,
        mediaUrl: m.storageId ? await ctx.storage.getUrl(m.storageId) : null,
      }))
    );
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;
    const contact = await ctx.db.get(conversation.contactId);
    if (!contact) return null;

    const students = await Promise.all(contact.linkedStudentIds.map((id) => ctx.db.get(id)));

    return {
      conversation,
      contact,
      students: students.filter((s): s is Doc<"students"> => s !== null),
    };
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return;
    await ctx.db.patch(conversationId, { unreadCount: 0 });

    if (!conversation.connectionId) return;
    const connectionId = conversation.connectionId;
    const [connection, lastInbound] = await Promise.all([
      ctx.db
        .query("whatsappConnections")
        .withIndex("by_connectionId", (q) => q.eq("connectionId", connectionId))
        .unique(),
      ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .filter((q) => q.eq(q.field("direction"), "in"))
        .order("desc")
        .first(),
    ]);
    if (connection && lastInbound) {
      await ctx.scheduler.runAfter(0, internal.waha.markAsRead, {
        session: connection.wahaSessionId,
        chatId: conversation.waChatId,
        messageId: lastInbound.waMessageId,
      });
    }
  },
});

// --- Outbound reply --------------------------------------------------------

export const recordOutbound = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
    providerMessageId: v.string(),
    authorType: v.union(v.literal("humano"), v.literal("agente")),
  },
  handler: async (ctx, { conversationId, text, providerMessageId, authorType }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversación no encontrada");
    const ownership = conversation.ownershipState ?? "HUMAN_ACTIVE";
    if (authorType === "agente" && ownership !== "AGENT_ACTIVE") {
      throw new Error("El agente no controla esta conversación");
    }
    if (authorType === "humano" && ownership !== "HUMAN_ACTIVE") {
      throw new Error("Toma el control humano antes de responder");
    }

    const duplicate = conversation.connectionId
      ? await ctx.db
          .query("messages")
          .withIndex("by_connection_waMessageId", (q) =>
            q.eq("connectionId", conversation.connectionId!).eq("waMessageId", providerMessageId)
          )
          .first()
      : await ctx.db
          .query("messages")
          .withIndex("by_waMessageId", (q) => q.eq("waMessageId", providerMessageId))
          .first();
    if (duplicate) return duplicate._id;

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      connectionId: conversation.connectionId,
      conversationId,
      waMessageId: providerMessageId,
      direction: "out",
      authorType,
      body: text,
      timestamp: now,
      hasMedia: false,
      sendStatus: "PENDING",
      sendAttemptedAt: now,
    });
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessagePreview: preview(text, false),
      lastMessageDirection: "out",
      unreadCount: 0,
    });
    return messageId;
  },
});

export const confirmOutbound = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.union(v.literal("SENT"), v.literal("AMBIGUOUS"), v.literal("FAILED")),
    sendError: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, status, sendError }) => {
    const message = await ctx.db.get(messageId);
    if (!message) return;
    await ctx.db.patch(messageId, {
      sendStatus: status,
      ...(sendError ? { sendError } : {}),
    });
    if (message.connectionId) {
      const connectionId = message.connectionId;
      const connection = await ctx.db
        .query("whatsappConnections")
        .withIndex("by_connectionId", (q) => q.eq("connectionId", connectionId))
        .unique();
      if (connection) {
        await ctx.db.patch(connection._id, {
          ...(status === "SENT" ? { lastOutboundAt: Date.now() } : {}),
          ...(sendError ? { lastError: sendError } : {}),
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const sendReply = action({
  args: { conversationId: v.id("conversations"), text: v.string() },
  handler: async (ctx, { conversationId, text }): Promise<{ ok: boolean; error?: string }> => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "Mensaje vacío" };

    const data = await ctx.runQuery(internal.crm.getChatIdForConversation, { conversationId });
    if (!data) return { ok: false, error: "Conversación no encontrada" };

    const providerMessageId = crypto.randomUUID();
    let messageId: Id<"messages"> | null = null;
    try {
      // WAHA accepts caller-provided ids. Persist exactly that id before the
      // network request so webhook echoes and acks race safely with the reply.
      messageId = await ctx.runMutation(internal.crm.recordOutbound, {
        conversationId,
        text: trimmed,
        providerMessageId,
        authorType: "humano",
      });
      await ctx.runAction(internal.waha.sendText, {
        chatId: data.waChatId,
        text: trimmed,
        id: providerMessageId,
        session: data.session,
      });
      await ctx.runMutation(internal.crm.confirmOutbound, {
        messageId,
        status: "SENT",
      });
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Error al enviar";
      // Any transport failure after dispatch may still have reached WAHA. Keep
      // it visible and require a human decision instead of retrying blindly.
      if (messageId) {
        await ctx.runMutation(internal.crm.confirmOutbound, {
          messageId,
          status: "AMBIGUOUS",
          sendError: error,
        });
      }
      return { ok: false, error };
    }
  },
});

export const getChatIdForConversation = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;
    const connectionId = conversation.connectionId;
    const connection = connectionId
      ? await ctx.db
          .query("whatsappConnections")
          .withIndex("by_connectionId", (q) => q.eq("connectionId", connectionId))
          .unique()
      : null;
    return {
      waChatId: conversation.waChatId,
      session: connection?.wahaSessionId ?? process.env.WAHA_SESSION?.trim() ?? "default",
    };
  },
});

export const findOutboundByProviderId = internalQuery({
  args: { conversationId: v.id("conversations"), providerMessageId: v.string() },
  handler: async (ctx, { conversationId, providerMessageId }) => {
    if (!providerMessageId) return null;
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;
    const connectionId = conversation.connectionId;
    const message = connectionId
      ? await ctx.db
          .query("messages")
          .withIndex("by_connection_waMessageId", (q) =>
            q.eq("connectionId", connectionId).eq("waMessageId", providerMessageId)
          )
          .first()
      : await ctx.db
          .query("messages")
          .withIndex("by_waMessageId", (q) => q.eq("waMessageId", providerMessageId))
          .first();
    return message?._id ?? null;
  },
});

export const takeOverConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversación no encontrada");
    await ctx.db.patch(conversationId, { ownershipState: "HUMAN_ACTIVE" });
  },
});

export const resumeAgent = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversación no encontrada");
    await ctx.db.patch(conversationId, { ownershipState: "AGENT_ACTIVE" });
  },
});

export const setConversationOwnership = mutation({
  args: {
    conversationId: v.id("conversations"),
    state: v.union(v.literal("PAUSED"), v.literal("CLOSED")),
  },
  handler: async (ctx, { conversationId, state }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversación no encontrada");
    await ctx.db.patch(conversationId, { ownershipState: state });
  },
});

// --- Contacts: clientes / interesados --------------------------------------

export const listContacts = query({
  args: { kind: v.union(v.literal("cliente"), v.literal("interesado"), v.literal("otro")) },
  handler: async (ctx, { kind }) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_kind", (q) => q.eq("kind", kind))
      .take(200);

    return Promise.all(
      contacts.map(async (c) => {
        const students = await Promise.all(c.linkedStudentIds.map((id) => ctx.db.get(id)));
        const conversation = await ctx.db
          .query("conversations")
          .withIndex("by_chatId", (q) => q.eq("waChatId", c.waChatId))
          .first();
        return {
          ...c,
          studentNames: students.filter((s) => s !== null).map((s) => s!.name),
          conversationId: conversation?._id ?? null,
          lastMessageAt: conversation?.lastMessageAt ?? null,
        };
      })
    );
  },
});

export const setContactStage = mutation({
  args: {
    contactId: v.id("contacts"),
    stage: v.union(
      v.literal("nuevo"),
      v.literal("contactado"),
      v.literal("clase_prueba"),
      v.literal("inscrito"),
      v.literal("perdido")
    ),
    lostReason: v.optional(v.string()),
  },
  handler: async (ctx, { contactId, stage, lostReason }) => {
    await ctx.db.patch(contactId, { stage, lostReason, updatedAt: Date.now() });
  },
});

export const setContactKind = mutation({
  args: {
    contactId: v.id("contacts"),
    kind: v.union(v.literal("cliente"), v.literal("interesado"), v.literal("otro")),
  },
  handler: async (ctx, { contactId, kind }) => {
    await ctx.db.patch(contactId, { kind, updatedAt: Date.now() });
  },
});

/** Re-run the phone match for a contact. Mom is the authority on messy numbers. */
export const relinkContact = mutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    const contact = await ctx.db.get(contactId);
    if (!contact) return;
    const students = await findStudentsByPhone(ctx, contact.normalizedPhone);
    await ctx.db.patch(contactId, {
      linkedStudentIds: students.map((s) => s._id),
      kind: students.length > 0 ? "cliente" : contact.kind,
      updatedAt: Date.now(),
    });
  },
});
