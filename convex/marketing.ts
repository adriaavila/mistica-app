import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type MarketingSegment = "natacion" | "aquagym" | "all";
type MarketingProgram = "natacion" | "aquagym";

type RecipientGroup = {
  normalizedPhone: string;
  originalPhone: string;
  program: MarketingProgram;
  recipientName: string;
  studentName: string;
  studentId: Id<"students">;
};

// Helper: Normalize phones to international format
export function normalizePhone(phone: string): string | null {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return null;

  // If it starts with '0', assume Venezuelan and replace with '58'
  if (cleaned.startsWith("0")) {
    cleaned = "58" + cleaned.slice(1);
  } else if (cleaned.length === 10 && (cleaned.startsWith("4") || cleaned.startsWith("2"))) {
    // If it is 10 digits and starts with 4 or 2, it might be a Venezuelan number without leading 0
    cleaned = "58" + cleaned;
  } else if (cleaned.length === 8 && (cleaned.startsWith("7") || cleaned.startsWith("6"))) {
    // If it is 8 digits and starts with 7 or 6, it might be Bolivian number without country code 591
    cleaned = "591" + cleaned;
  }

  if (cleaned.length < 8) return null;
  return cleaned;
}

// Helper: Map modality to program segment
function getProgramFromModality(modality: string): "natacion" | "aquagym" | "unknown" {
  if (modality === "lmv" || modality === "mj" || modality === "nat5x") {
    return "natacion";
  }
  if (modality === "aquagym3x" || modality === "aquagym5x") {
    return "aquagym";
  }
  return "unknown";
}

function replaceTemplateVariables(template: string, recipientName: string, studentName: string) {
  return template
    .replaceAll("{{nombre}}", recipientName)
    .replaceAll("{{alumno}}", studentName || recipientName);
}

export function renderMarketingMessage(
  template: string,
  recipientName: string,
  studentName: string
) {
  return replaceTemplateVariables(template, recipientName, studentName);
}

function buildRecipientGroups(activeStudents: Doc<"students">[], targetSegment: MarketingSegment) {
  const groupsByPhone = new Map<string, Doc<"students">[]>();

  for (const student of activeStudents) {
    const program = getProgramFromModality(student.modality);
    if (program === "unknown") continue;
    if (targetSegment !== "all" && program !== targetSegment) continue;

    const phone = program === "natacion"
      ? student.payerPhone || student.guardianPhone || student.phone
      : student.payerPhone || student.phone;
    const normalized = normalizePhone(phone);
    if (!normalized) continue;

    const group = groupsByPhone.get(normalized) ?? [];
    group.push(student);
    groupsByPhone.set(normalized, group);
  }

  const recipients: RecipientGroup[] = [];
  for (const [normalizedPhone, students] of groupsByPhone) {
    const natacionStudents = students.filter(
      (student) => getProgramFromModality(student.modality) === "natacion"
    );
    const program: MarketingProgram = natacionStudents.length > 0 ? "natacion" : "aquagym";
    const primaryStudent = program === "natacion" ? natacionStudents[0] : students[0];
    const originalPhone = program === "natacion"
      ? primaryStudent.payerPhone || primaryStudent.guardianPhone || primaryStudent.phone
      : primaryStudent.payerPhone || primaryStudent.phone;
    const studentName = program === "natacion"
      ? natacionStudents.map((student) => student.name).join(" y ")
      : students.map((student) => student.name).join(" y ");
    const recipientName = program === "natacion"
      ? primaryStudent.guardianName || primaryStudent.name
      : studentName;

    recipients.push({
      normalizedPhone,
      originalPhone,
      program,
      recipientName,
      studentName,
      studentId: primaryStudent._id,
    });
  }

  return recipients;
}

function getMessageCounts(messages: Doc<"marketingMessages">[]) {
  return {
    total: messages.length,
    pending: messages.filter((message) => message.status === "pending").length,
    sending: messages.filter((message) => message.status === "sending").length,
    sent: messages.filter((message) => message.status === "sent").length,
    error: messages.filter((message) => message.status === "error").length,
    skipped: messages.filter((message) => message.status === "skipped").length,
  };
}

// Helper: check and update campaign status based on message states
async function checkAndUpdateCampaignStatus(ctx: any, campaignId: Id<"marketingCampaigns">) {
  const messages = await ctx.db
    .query("marketingMessages")
    .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaignId))
    .collect();

  if (messages.length === 0) return;

  const total = messages.length;
  const sent = messages.filter((m: any) => m.status === "sent").length;
  const error = messages.filter((m: any) => m.status === "error").length;
  const skipped = messages.filter((m: any) => m.status === "skipped").length;
  const pending = messages.filter((m: any) => m.status === "pending").length;
  const sending = messages.filter((m: any) => m.status === "sending").length;

  const campaign = await ctx.db.get(campaignId);
  if (!campaign) return;

  let newStatus = campaign.status;
  let finishedAt = campaign.finishedAt;

  if (pending === 0 && sending === 0) {
    if (error > 0) {
      newStatus = "error";
    } else {
      newStatus = "done";
    }
    finishedAt = Date.now();
  } else if (sending > 0 || (sent + error + skipped > 0)) {
    newStatus = "sending";
  }

  await ctx.db.patch(campaignId, {
    status: newStatus,
    finishedAt,
    updatedAt: Date.now(),
  });
}

// 1. Create a Mother's Day campaign
export const createMothersDayCampaign = mutation({
  args: {
    segment: v.union(v.literal("natacion"), v.literal("aquagym"), v.literal("all")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name ?? `Día de la Madre - ${args.segment.charAt(0).toUpperCase() + args.segment.slice(1)}`;
    const campaignId = await ctx.db.insert("marketingCampaigns", {
      name,
      type: "mothers_day",
      segment: args.segment,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(`[CAMPAIGN] Campaign created: ${name} (${campaignId})`);
    return campaignId;
  },
});

// 2. List all marketing campaigns
export const listMarketingCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("marketingCampaigns").collect();
    const sortedCampaigns = campaigns.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(sortedCampaigns.map(async (campaign) => {
      const messages = await ctx.db
        .query("marketingMessages")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaign._id))
        .collect();
      const imageUrl = campaign.imageStorageId
        ? await ctx.storage.getUrl(campaign.imageStorageId)
        : null;
      return {
        ...campaign,
        imageUrl,
        counts: getMessageCounts(messages),
      };
    }));
  },
});

// 3. Get details of a single marketing campaign
export const getMarketingCampaign = query({
  args: { campaignId: v.id("marketingCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;
    const imageUrl = campaign.imageStorageId
      ? await ctx.storage.getUrl(campaign.imageStorageId)
      : null;
    return { ...campaign, imageUrl };
  },
});

export const generateMarketingImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const createMarketingCampaign = mutation({
  args: {
    name: v.string(),
    segment: v.union(v.literal("natacion"), v.literal("aquagym"), v.literal("all")),
    messageTemplate: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageMimeType: v.optional(v.string()),
    imageFileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("marketingCampaigns", {
      name: args.name,
      type: "custom",
      segment: args.segment,
      messageTemplate: args.messageTemplate,
      imageStorageId: args.imageStorageId,
      imageMimeType: args.imageMimeType,
      imageFileName: args.imageFileName,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const prepareMarketingRecipients = mutation({
  args: { campaignId: v.id("marketingCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.messageTemplate) throw new Error("Campaign message is missing");

    const existingMessages = await ctx.db
      .query("marketingMessages")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    if (existingMessages.length > 0) {
      return { preparedCount: existingMessages.length };
    }

    const activeStudents = await ctx.db
      .query("students")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const recipients = buildRecipientGroups(activeStudents, campaign.segment);

    for (const recipient of recipients) {
      await ctx.db.insert("marketingMessages", {
        campaignId: args.campaignId,
        studentId: recipient.studentId,
        recipientName: recipient.recipientName,
        studentName: recipient.studentName,
        phone: recipient.originalPhone,
        normalizedPhone: recipient.normalizedPhone,
        program: recipient.program,
        message: replaceTemplateVariables(
          campaign.messageTemplate,
          recipient.recipientName,
          recipient.studentName
        ),
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(args.campaignId, {
      status: recipients.length > 0 ? "ready" : "draft",
      updatedAt: Date.now(),
    });

    return { preparedCount: recipients.length };
  },
});

// 4. Prepare recipients for Mother's Day campaign
export const prepareMothersDayRecipients = mutation({
  args: {
    campaignId: v.id("marketingCampaigns"),
    segment: v.optional(v.union(v.literal("natacion"), v.literal("aquagym"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const campaignId = args.campaignId;
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    const targetSegment = args.segment ?? campaign.segment;

    // Fetch existing messages for this campaign to see what's already sent or sending
    const existingMessages = await ctx.db
      .query("marketingMessages")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();

    // Track phones already in sent/sending state to avoid re-preparing them
    const activePhones = new Set<string>();
    for (const msg of existingMessages) {
      if (msg.status === "sent" || msg.status === "sending") {
        activePhones.add(msg.normalizedPhone);
      } else {
        // Delete pending, skipped, or error messages so they can be regenerated
        await ctx.db.delete(msg._id);
      }
    }

    // Fetch active students
    const activeStudents = await ctx.db
      .query("students")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Group students by normalized phone number
    const groupsByPhone: Record<string, typeof activeStudents> = {};

    for (const student of activeStudents) {
      const program = getProgramFromModality(student.modality);

      // Filter by segment
      if (targetSegment === "natacion" && program !== "natacion") continue;
      if (targetSegment === "aquagym" && program !== "aquagym") continue;
      if (targetSegment === "all" && program !== "natacion" && program !== "aquagym") continue;

      let phone = "";
      if (program === "natacion") {
        phone = student.payerPhone || student.guardianPhone || student.phone;
      } else {
        phone = student.payerPhone || student.phone;
      }

      const normalized = normalizePhone(phone);
      if (!normalized) continue; // Skip if no valid phone

      if (!groupsByPhone[normalized]) {
        groupsByPhone[normalized] = [];
      }
      groupsByPhone[normalized].push(student);
    }

    let preparedCount = 0;

    // Build messages for each phone group
    for (const [normalized, group] of Object.entries(groupsByPhone)) {
      // Skip if this phone is already sent or sending in this campaign
      if (activePhones.has(normalized)) continue;

      // Double check in the database to be absolutely sure no duplicate exists (pending/sent/error/etc.)
      const existing = await ctx.db
        .query("marketingMessages")
        .withIndex("by_campaign_phone", (q) =>
          q.eq("campaignId", campaignId).eq("normalizedPhone", normalized)
        )
        .first();
      if (existing) continue;

      // Determine program segment of this group
      // Prioritize natacion if there is a mix
      const hasNatacion = group.some(s => getProgramFromModality(s.modality) === "natacion");
      const program = hasNatacion ? "natacion" : "aquagym";

      let studentId: Id<"students"> | undefined = group[0]._id;
      let recipientName = "";
      let studentName = "";
      let message = "";
      const originalPhone = group[0].payerPhone || group[0].guardianPhone || group[0].phone;

      if (program === "natacion") {
        const natStudents = group.filter(s => getProgramFromModality(s.modality) === "natacion");
        const studentNames = natStudents.map(s => s.name).join(" y ");
        const firstStudent = natStudents[0];
        
        studentId = firstStudent._id;
        recipientName = firstStudent.guardianName || firstStudent.name;
        studentName = studentNames;

        message = `Hola 💙\n\nDe parte de Mística Natación & Aquagym queremos enviar un saludo especial por el Día de la Madre.\n\nGracias por acompañar el proceso de ${studentName} con tanto amor, constancia y confianza. Para nosotros es muy especial ver cómo cada alumno crece, aprende y gana seguridad en el agua 🌊\n\nCon cariño,\nEquipo Mística`;
      } else {
        // Aquagym
        const recipientNames = group.map(s => s.name).join(" y ");
        recipientName = recipientNames;
        studentName = "";

        message = `Hola ${recipientName} 💙\n\nEn Mística Natación & Aquagym queremos enviarte un saludo especial por el Día de la Madre.\n\nGracias por ser parte de nuestra comunidad y por compartir con nosotras momentos de salud, movimiento, bienestar y alegría en el agua 🌊\n\nCon cariño,\nEquipo Mística`;
      }

      await ctx.db.insert("marketingMessages", {
        campaignId,
        studentId,
        recipientName,
        studentName: program === "natacion" ? studentName : undefined,
        phone: originalPhone,
        normalizedPhone: normalized,
        program,
        message,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      preparedCount++;
    }

    // Update campaign status
    await ctx.db.patch(campaignId, {
      status: "ready",
      updatedAt: Date.now(),
    });

    return { preparedCount };
  },
});

// 5. List all messages in a campaign
export const listCampaignMessages = query({
  args: { campaignId: v.id("marketingCampaigns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("marketingMessages")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});

// 6. Mark a marketing message as sending
export const markMarketingMessageSending = mutation({
  args: { messageId: v.id("marketingMessages") },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    await ctx.db.patch(args.messageId, {
      status: "sending",
      updatedAt: Date.now(),
    });

    // Update campaign status to sending if it is currently ready or draft
    const campaign = await ctx.db.get(msg.campaignId);
    if (campaign && (campaign.status === "ready" || campaign.status === "draft")) {
      await ctx.db.patch(msg.campaignId, {
        status: "sending",
        startedAt: campaign.startedAt ?? Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// 7. Mark a marketing message as sent
export const markMarketingMessageSent = mutation({
  args: { messageId: v.id("marketingMessages") },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    await ctx.db.patch(args.messageId, {
      status: "sent",
      sentAt: Date.now(),
      updatedAt: Date.now(),
    });

    await checkAndUpdateCampaignStatus(ctx, msg.campaignId);
  },
});

// 8. Mark a marketing message as failed with an error
export const markMarketingMessageError = mutation({
  args: {
    messageId: v.id("marketingMessages"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    await ctx.db.patch(args.messageId, {
      status: "error",
      error: args.error,
      updatedAt: Date.now(),
    });

    await checkAndUpdateCampaignStatus(ctx, msg.campaignId);
  },
});

// 9. Reset failed marketing messages for a campaign back to pending
export const resetFailedMarketingMessages = mutation({
  args: { campaignId: v.id("marketingCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    const messages = await ctx.db
      .query("marketingMessages")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    let resetCount = 0;
    for (const msg of messages) {
      if (msg.status === "error") {
        await ctx.db.patch(msg._id, {
          status: "pending",
          error: undefined,
          updatedAt: Date.now(),
        });
        resetCount++;
      }
    }

    if (resetCount > 0) {
      await ctx.db.patch(args.campaignId, {
        status: "ready",
        finishedAt: undefined,
        updatedAt: Date.now(),
      });
    }

    return { resetCount };
  },
});

// 10. Set campaign status
export const setMarketingCampaignStatus = mutation({
  args: {
    campaignId: v.id("marketingCampaigns"),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("sending"),
      v.literal("paused"),
      v.literal("done"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    await ctx.db.patch(args.campaignId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});
