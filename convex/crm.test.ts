import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const CHAT_ID = "59171234567@c.us";

function inboundPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "false_59171234567@c.us_ABC123",
    timestamp: 1_800_000_000, // seconds, as WAHA sends
    from: CHAT_ID,
    fromMe: false,
    to: "59170000000@c.us",
    body: "Hola, quiero información",
    hasMedia: false,
    _data: { notifyName: "Ana Perez" },
    ...overrides,
  };
}

async function seedStudent(
  t: ReturnType<typeof convexTest>,
  fields: { name: string; phone: string; payerPhone?: string; guardianPhone?: string }
) {
  return t.run(async (ctx) => {
    const timeSlotId = await ctx.db.insert("timeSlots", {
      label: "LMV 3–4 pm",
      days: ["Mon", "Wed", "Fri"],
      startTime: "15:00",
      endTime: "16:00",
      isActive: true,
      maxCapacity: 20,
      modalities: ["lmv"],
    });
    return ctx.db.insert("students", {
      name: fields.name,
      phone: fields.phone,
      payerPhone: fields.payerPhone,
      guardianPhone: fields.guardianPhone,
      enrollmentDate: "2026-01-15",
      modality: "lmv",
      timeSlotId,
      status: "active",
      createdAt: Date.now(),
    });
  });
}

describe("crm inbound ingest", () => {
  it("creates contact, conversation and message from a first inbound", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });

    const { contacts, conversations, messages } = await t.run(async (ctx) => ({
      contacts: await ctx.db.query("contacts").collect(),
      conversations: await ctx.db.query("conversations").collect(),
      messages: await ctx.db.query("messages").collect(),
    }));

    expect(contacts).toHaveLength(1);
    expect(contacts[0].waChatId).toBe(CHAT_ID);
    expect(contacts[0].normalizedPhone).toBe("59171234567");
    expect(contacts[0].displayName).toBe("Ana Perez");
    expect(contacts[0].kind).toBe("interesado"); // no matching student
    expect(contacts[0].stage).toBe("nuevo");

    expect(conversations).toHaveLength(1);
    expect(conversations[0].unreadCount).toBe(1);
    expect(conversations[0].lastMessagePreview).toBe("Hola, quiero información");

    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe("in");
    expect(messages[0].timestamp).toBe(1_800_000_000_000); // seconds -> ms
  });

  it("is idempotent on waMessageId (WAHA retries)", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });

    const { messages, conversations, contacts } = await t.run(async (ctx) => ({
      messages: await ctx.db.query("messages").collect(),
      conversations: await ctx.db.query("conversations").collect(),
      contacts: await ctx.db.query("contacts").collect(),
    }));

    expect(messages).toHaveLength(1);
    expect(conversations).toHaveLength(1);
    expect(contacts).toHaveLength(1);
    expect(conversations[0].unreadCount).toBe(1);
  });

  it("links a known guardian by any of the three student phone fields", async () => {
    for (const field of ["phone", "payerPhone", "guardianPhone"] as const) {
      const t = convexTest(schema);
      await seedStudent(t, {
        name: "Lucia Gomez",
        phone: field === "phone" ? "71234567" : "70000001",
        payerPhone: field === "payerPhone" ? "71234567" : undefined,
        guardianPhone: field === "guardianPhone" ? "71234567" : undefined,
      });

      await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });

      const contacts = await t.run((ctx) => ctx.db.query("contacts").collect());
      expect(contacts[0].kind, `matched via ${field}`).toBe("cliente");
      expect(contacts[0].linkedStudentIds, `matched via ${field}`).toHaveLength(1);
      expect(contacts[0].stage).toBeUndefined();
    }
  });

  it("ignores groups, status broadcasts and channels", async () => {
    const t = convexTest(schema);
    for (const from of ["120363043211234567@g.us", "status@broadcast", "1234@newsletter"]) {
      await t.mutation(internal.crm.ingestInbound, {
        payload: inboundPayload({ from, id: `id-${from}` }),
      });
    }
    const messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages).toHaveLength(0);
  });

  it("flags media that WAHA did not attach instead of silently dropping it", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, {
      payload: inboundPayload({ hasMedia: true, body: "", media: null }),
    });

    const messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages[0].hasMedia).toBe(true);
    expect(messages[0].storageId).toBeUndefined();
    expect(messages[0].mediaError).toContain("descarga de medios desactivada");
  });

  it("counts an outbound echo without incrementing unread", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });
    await t.mutation(internal.crm.ingestInbound, {
      payload: inboundPayload({ id: "out-1", fromMe: true, to: CHAT_ID, from: "59170000000@c.us", body: "Buenas" }),
    });

    const conversations = await t.run((ctx) => ctx.db.query("conversations").collect());
    expect(conversations).toHaveLength(1);
    expect(conversations[0].unreadCount).toBe(1); // unchanged by our own message
    expect(conversations[0].lastMessagePreview).toBe("Buenas");
  });
});

describe("crm ack handling", () => {
  it("advances ack but never moves it backwards", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });
    const id = inboundPayload().id;

    await t.mutation(internal.crm.updateAck, { payload: { id, ack: 2 } });
    let messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages[0].ack).toBe(2);

    await t.mutation(internal.crm.updateAck, { payload: { id, ack: 3 } });
    messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages[0].ack).toBe(3);

    // Out-of-order delivery ack must not undo "read".
    await t.mutation(internal.crm.updateAck, { payload: { id, ack: 1 } });
    messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages[0].ack).toBe(3);
  });

  it("ignores acks for unknown messages", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(internal.crm.updateAck, { payload: { id: "nope", ack: 3 } })
    ).resolves.not.toThrow();
  });
});

describe("crm receipts", () => {
  it("opens a pending receipt for an inbound image", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, {
      payload: inboundPayload({ hasMedia: true, body: "", media: { url: "http://localhost:3000/api/files/x.jpg" } }),
    });

    const messageId = await t.run(async (ctx) => {
      const m = await ctx.db.query("messages").first();
      return m!._id;
    });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["fake"], { type: "image/jpeg" })));

    await t.mutation(internal.crm.attachMedia, { messageId, storageId, mimeType: "image/jpeg" });

    const receipts = await t.run((ctx) => ctx.db.query("receipts").collect());
    expect(receipts).toHaveLength(1);
    expect(receipts[0].status).toBe("pendiente");
  });

  it("does not open a receipt for a non-image or for our own outbound image", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, {
      payload: inboundPayload({ hasMedia: true, media: { url: "http://localhost:3000/api/files/x.pdf" } }),
    });
    const messageId = await t.run(async (ctx) => (await ctx.db.query("messages").first())!._id);
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["fake"], { type: "application/pdf" })));

    await t.mutation(internal.crm.attachMedia, { messageId, storageId, mimeType: "application/pdf" });

    const receipts = await t.run((ctx) => ctx.db.query("receipts").collect());
    expect(receipts).toHaveLength(0);
  });
});

describe("crm inbox queries", () => {
  it("marks a conversation as needing a reply until we answer", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });

    let list = await t.query(api.crm.listConversations, {});
    expect(list).toHaveLength(1);
    expect(list[0].needsReply).toBe(true);
    expect(list[0].contactName).toBe("Ana Perez");

    await t.mutation(internal.crm.ingestInbound, {
      payload: inboundPayload({ id: "out-1", fromMe: true, to: CHAT_ID, from: "59170000000@c.us", body: "Claro" }),
    });

    list = await t.query(api.crm.listConversations, {});
    expect(list[0].needsReply).toBe(false);
  });

  it("clears unread on markRead", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.crm.ingestInbound, { payload: inboundPayload() });
    const conversationId = await t.run(async (ctx) => (await ctx.db.query("conversations").first())!._id);

    await t.mutation(api.crm.markRead, { conversationId });

    const conversation = await t.run((ctx) => ctx.db.get(conversationId));
    expect(conversation!.unreadCount).toBe(0);
  });
});
