import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const getContext = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.direction !== "in") return null;
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.ownershipState !== "AGENT_ACTIVE" || !conversation.connectionId) return null;
    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_connectionId", (q) => q.eq("connectionId", conversation.connectionId!))
      .unique();
    if (!connection) return null;
    const [classes, slots] = await Promise.all([
      ctx.db.query("classes").withIndex("by_active", (q) => q.eq("isActive", true)).collect(),
      ctx.db.query("timeSlots").withIndex("by_active", (q) => q.eq("isActive", true)).collect(),
    ]);
    return { message, conversation, connection, classes, slots };
  },
});

export const finish = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
    state: v.optional(v.union(v.literal("HUMAN_ACTIVE"), v.literal("PAUSED"))),
  },
  handler: async (ctx, { conversationId, summary, state }) => {
    await ctx.db.patch(conversationId, {
      agentSummary: summary.slice(0, 500),
      ...(state ? { ownershipState: state } : {}),
    });
  },
});

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function decideAgentReply(
  text: string,
  classes: Array<{ name: string; price: number }>,
  slots: Array<{ label: string }>,
): { reply: string | null; handoff: boolean; pause: boolean } {
  if (includesAny(text, ["no escribir", "no me escrib", "darse de baja", "stop", "cancelar mensajes"])) {
    return { reply: null, handoff: false, pause: true };
  }
  if (includesAny(text, ["precio", "costo", "cuánto", "cuanto", "mensualidad"])) {
    const prices = classes.map((item) => `${item.name}: Bs ${item.price}`).join("; ");
    return prices
      ? { reply: `Estos son los precios registrados: ${prices}. ¿Te interesa natación o aquagym y para qué edad?`, handoff: false, pause: false }
      : { reply: "No tengo precios aprobados disponibles. Te paso con una persona del equipo.", handoff: true, pause: false };
  }
  if (includesAny(text, ["horario", "hora", "día", "dia", "cuando", "cuándo"])) {
    const schedules = slots.map((slot) => slot.label).join("; ");
    return schedules
      ? { reply: `Los horarios activos registrados son: ${schedules}. ¿Buscas natación o aquagym?`, handoff: false, pause: false }
      : { reply: "No tengo horarios aprobados disponibles. Te paso con una persona del equipo.", handoff: true, pause: false };
  }
  if (includesAny(text, ["descuento", "negoci", "reembolso", "devoluci", "lesión", "lesion", "médico", "medico", "queja", "reclamo"])) {
    return { reply: "Ese tema necesita revisión humana. Ya lo dejé en manos del equipo.", handoff: true, pause: false };
  }
  if (includesAny(text, ["natación", "natacion", "aquagym", "aqua gym", "clase", "inscripción", "inscripcion", "hola", "buenas"])) {
    return { reply: "¡Hola! Para orientarte, dime si buscas natación o aquagym, para qué edad y qué horario prefieres.", handoff: false, pause: false };
  }
  return { reply: "No quiero darte información incierta. Te paso con una persona del equipo.", handoff: true, pause: false };
}

export const maybeReply = internalAction({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const context = await ctx.runQuery(internal.agent.getContext, { messageId });
    if (!context) return;

    const text = context.message.body.trim().toLocaleLowerCase("es");
    const decision = decideAgentReply(text, context.classes, context.slots);
    if (decision.pause) {
      await ctx.runMutation(internal.agent.finish, {
        conversationId: context.conversation._id,
        summary: "La persona solicitó no recibir más mensajes.",
        state: "PAUSED",
      });
      return;
    }

    const reply = decision.reply!;
    const handoff = decision.handoff;

    const providerMessageId = crypto.randomUUID();
    let outboundId: Id<"messages"> | null = null;
    try {
      outboundId = await ctx.runMutation(internal.crm.recordOutbound, {
        conversationId: context.conversation._id,
        text: reply,
        providerMessageId,
        authorType: "agente",
      });
      await ctx.runAction(internal.waha.sendText, {
        chatId: context.conversation.waChatId,
        text: reply,
        id: providerMessageId,
        session: context.connection.wahaSessionId,
      });
      await ctx.runMutation(internal.crm.confirmOutbound, { messageId: outboundId, status: "SENT" });
      await ctx.runMutation(internal.agent.finish, {
        conversationId: context.conversation._id,
        summary: `Motivo detectado: ${text.slice(0, 240)}. Respuesta: ${reply.slice(0, 240)}`,
        ...(handoff ? { state: "HUMAN_ACTIVE" as const } : {}),
      });
    } catch (error) {
      if (outboundId) {
        await ctx.runMutation(internal.crm.confirmOutbound, {
          messageId: outboundId,
          status: "AMBIGUOUS",
          sendError: error instanceof Error ? error.message : "Error de envío",
        });
      }
      await ctx.runMutation(internal.agent.finish, {
        conversationId: context.conversation._id,
        summary: "El agente no pudo enviar; requiere revisión humana.",
        state: "HUMAN_ACTIVE",
      });
    }
  },
});
