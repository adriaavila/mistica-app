import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
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
  args: { payload: v.any() },
  handler: async (ctx, { payload }) => {
    const waMessageId: string | undefined = payload?.id;
    if (!waMessageId) return;

    // WAHA retries on any non-2xx, so the same message can arrive several times.
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_waMessageId", (q) => q.eq("waMessageId", waMessageId))
      .first();
    if (existing) return;

    const fromMe: boolean = payload.fromMe === true;
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
    let contact = await ctx.db
      .query("contacts")
      .withIndex("by_chatId", (q) => q.eq("waChatId", chatId))
      .first();

    if (!contact) {
      const students = await findStudentsByPhone(ctx, normalized);
      const pushName: string = payload._data?.notifyName || payload.notifyName || "";
      const contactId = await ctx.db.insert("contacts", {
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
    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_chatId", (q) => q.eq("waChatId", chatId))
      .first();

    if (!conversation) {
      const conversationId = await ctx.db.insert("conversations", {
        contactId: contact._id,
        waChatId: chatId,
        status: "abierta",
        lastMessageAt: now,
        lastMessagePreview: preview(body, hasMedia),
        lastMessageDirection: fromMe ? "out" : "in",
        unreadCount: 0,
        createdAt: now,
      });
      conversation = (await ctx.db.get(conversationId))!;
    }

    // WAHA timestamps are seconds.
    const timestamp = typeof payload.timestamp === "number" ? payload.timestamp * 1000 : now;

    const messageId = await ctx.db.insert("messages", {
      conversationId: conversation._id,
      waMessageId,
      direction: fromMe ? "out" : "in",
      authorType: fromMe ? "humano" : "contacto",
      body,
      timestamp,
      hasMedia,
    });

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
  },
});

export const updateAck = internalMutation({
  args: { payload: v.any() },
  handler: async (ctx, { payload }) => {
    const waMessageId: string | undefined = payload?.id;
    const ack: number | undefined = payload?.ack;
    if (!waMessageId || typeof ack !== "number") return;

    const message = await ctx.db
      .query("messages")
      .withIndex("by_waMessageId", (q) => q.eq("waMessageId", waMessageId))
      .first();
    if (!message) return;

    // Acks can arrive out of order; never move the status backwards.
    if ((message.ack ?? 0) >= ack) return;
    await ctx.db.patch(message._id, { ack });
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
    await ctx.db.patch(conversationId, { unreadCount: 0 });
  },
});

// --- Outbound reply --------------------------------------------------------

export const recordOutbound = internalMutation({
  args: { conversationId: v.id("conversations"), text: v.string(), localId: v.string() },
  handler: async (ctx, { conversationId, text, localId }) => {
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      waMessageId: localId,
      direction: "out",
      authorType: "humano",
      body: text,
      timestamp: now,
      hasMedia: false,
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
    waMessageId: v.optional(v.string()),
    sendError: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, waMessageId, sendError }) => {
    await ctx.db.patch(messageId, {
      ...(waMessageId ? { waMessageId } : {}),
      ...(sendError ? { sendError } : {}),
    });
  },
});

export const sendReply = action({
  args: { conversationId: v.id("conversations"), text: v.string() },
  handler: async (ctx, { conversationId, text }): Promise<{ ok: boolean; error?: string }> => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "Mensaje vacío" };

    const data = await ctx.runQuery(internal.crm.getChatIdForConversation, { conversationId });
    if (!data) return { ok: false, error: "Conversación no encontrada" };

    // Optimistic insert so the operator sees it immediately, then reconcile.
    const localId = `local:${crypto.randomUUID()}`;
    const messageId: Id<"messages"> = await ctx.runMutation(internal.crm.recordOutbound, {
      conversationId,
      text: trimmed,
      localId,
    });

    try {
      const res = await ctx.runAction(internal.waha.sendText, {
        chatId: data.waChatId,
        text: trimmed,
      });
      await ctx.runMutation(internal.crm.confirmOutbound, {
        messageId,
        waMessageId: res.id,
      });
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Error al enviar";
      await ctx.runMutation(internal.crm.confirmOutbound, { messageId, sendError: error });
      return { ok: false, error };
    }
  },
});

export const getChatIdForConversation = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    return conversation ? { waChatId: conversation.waChatId } : null;
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
