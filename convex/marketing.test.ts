import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("marketing campaigns", () => {
  it("should create campaign, prepare recipients, deduplicate, and process sending lifecycle", async () => {
    const t = convexTest(schema);

    // 1. Create a dummy time slot first as it is required by student table
    const timeSlotId = await t.mutation(api.timeSlots.create ?? "timeSlots:create", {
      label: "LMV 3–4 pm",
      days: ["Mon", "Wed", "Fri"],
      startTime: "15:00",
      endTime: "16:00",
      isActive: true,
      maxCapacity: 20,
      modalities: ["lmv"],
    } as any).catch(async () => {
      // In case timeSlots.create is not defined exactly, insert directly using a direct mock context if needed,
      // but convex-test allows direct insertion or calling api.timeSlots.create if it exists.
      // Let's check how slots are created. In seed.ts they use ctx.db.insert("timeSlots", ...)
      // With convex-test we can use t.run() to run raw db operations! That is extremely handy.
      return t.run(async (ctx) => {
        return ctx.db.insert("timeSlots", {
          label: "LMV 3–4 pm",
          days: ["Mon", "Wed", "Fri"],
          startTime: "15:00",
          endTime: "16:00",
          isActive: true,
          maxCapacity: 20,
          modalities: ["lmv"],
        });
      });
    });

    // 2. Insert active and inactive students using t.run
    await t.run(async (ctx) => {
      // Sibling 1 (Natacion): Payer phone set, Guardian phone set, active
      await ctx.db.insert("students", {
        name: "Carlos Perez",
        phone: "04121111111",
        dob: "2015-05-10",
        enrollmentDate: "2026-01-01",
        modality: "lmv",
        timeSlotId,
        status: "active",
        createdAt: Date.now(),
        payerPhone: "04129999999", // Sibling group key (primary)
        guardianPhone: "04128888888",
        guardianName: "Marta Perez",
      });

      // Sibling 2 (Natacion): Same payer phone, active
      await ctx.db.insert("students", {
        name: "Maria Perez",
        phone: "04121111111",
        dob: "2017-08-15",
        enrollmentDate: "2026-01-01",
        modality: "mj",
        timeSlotId,
        status: "active",
        createdAt: Date.now(),
        payerPhone: "04129999999", // Same phone as sibling 1
        guardianPhone: "04128888888",
        guardianName: "Marta Perez",
      });

      // Aquagym Student: active, only phone field populated
      await ctx.db.insert("students", {
        name: "Lucia Gomez",
        phone: "04142222222",
        dob: "1985-04-12",
        enrollmentDate: "2026-02-01",
        modality: "aquagym3x",
        timeSlotId,
        status: "active",
        createdAt: Date.now(),
      });

      // Inactive Student: should be skipped
      await ctx.db.insert("students", {
        name: "Juan Inactivo",
        phone: "04123333333",
        dob: "2016-09-20",
        enrollmentDate: "2026-01-01",
        modality: "lmv",
        timeSlotId,
        status: "suspended",
        createdAt: Date.now(),
      });

      // Student with invalid phone: should be skipped
      await ctx.db.insert("students", {
        name: "No Phone Student",
        phone: "123", // Too short to be valid
        dob: "2016-09-20",
        enrollmentDate: "2026-01-01",
        modality: "lmv",
        timeSlotId,
        status: "active",
        createdAt: Date.now(),
      });
    });

    // 3. Create campaign
    const campaignId = await t.mutation(api.marketing.createMothersDayCampaign, {
      segment: "all",
      name: "Día de la Madre Test",
    });

    const campaign = await t.query(api.marketing.getMarketingCampaign, { campaignId });
    expect(campaign).not.toBeNull();
    expect(campaign?.name).toBe("Día de la Madre Test");
    expect(campaign?.status).toBe("draft");

    // 4. Prepare recipients
    const prepResult = await t.mutation(api.marketing.prepareMothersDayRecipients, {
      campaignId,
    });
    // Expected preparedCount: 2 groups
    // Group 1: Carlos Perez & Maria Perez (normalized payerPhone: 584129999999)
    // Group 2: Lucia Gomez (normalized phone: 584142222222)
    expect(prepResult.preparedCount).toBe(2);

    // Verify campaign status updated to ready
    const campaignReady = await t.query(api.marketing.getMarketingCampaign, { campaignId });
    expect(campaignReady?.status).toBe("ready");

    // Verify messages
    const messages = await t.query(api.marketing.listCampaignMessages, { campaignId });
    expect(messages.length).toBe(2);

    // Check sibling group message (Natacion template, merged studentName, status pending)
    const siblingMsg = messages.find(m => m.normalizedPhone === "584129999999");
    expect(siblingMsg).toBeDefined();
    expect(siblingMsg?.recipientName).toBe("Marta Perez");
    expect(siblingMsg?.studentName).toBe("Carlos Perez y Maria Perez");
    expect(siblingMsg?.program).toBe("natacion");
    expect(siblingMsg?.status).toBe("pending");
    expect(siblingMsg?.message).toContain("Carlos Perez y Maria Perez");
    expect(siblingMsg?.message).toContain("Gracias por acompañar el proceso de");

    // Check Aquagym message (Aquagym template, status pending)
    const aqMsg = messages.find(m => m.normalizedPhone === "584142222222");
    expect(aqMsg).toBeDefined();
    expect(aqMsg?.recipientName).toBe("Lucia Gomez");
    expect(aqMsg?.program).toBe("aquagym");
    expect(aqMsg?.status).toBe("pending");
    expect(aqMsg?.message).toContain("Hola Lucia Gomez 💙");
    expect(aqMsg?.message).toContain("Gracias por ser parte de nuestra comunidad");

    // 5. Test sending progression
    // Mark siblingMsg as sending
    await t.mutation(api.marketing.markMarketingMessageSending, { messageId: siblingMsg!._id });
    const siblingMsgSending = (await t.query(api.marketing.listCampaignMessages, { campaignId }))
      .find(m => m._id === siblingMsg!._id);
    expect(siblingMsgSending?.status).toBe("sending");

    // Campaign status should transition to sending
    const campaignSending = await t.query(api.marketing.getMarketingCampaign, { campaignId });
    expect(campaignSending?.status).toBe("sending");
    expect(campaignSending?.startedAt).toBeDefined();

    // Mark siblingMsg as sent
    await t.mutation(api.marketing.markMarketingMessageSent, { messageId: siblingMsg!._id });
    const siblingMsgSent = (await t.query(api.marketing.listCampaignMessages, { campaignId }))
      .find(m => m._id === siblingMsg!._id);
    expect(siblingMsgSent?.status).toBe("sent");
    expect(siblingMsgSent?.sentAt).toBeDefined();

    // Mark aqMsg as sending, then error
    await t.mutation(api.marketing.markMarketingMessageSending, { messageId: aqMsg!._id });
    await t.mutation(api.marketing.markMarketingMessageError, { messageId: aqMsg!._id, error: "Failed connection" });
    const aqMsgError = (await t.query(api.marketing.listCampaignMessages, { campaignId }))
      .find(m => m._id === aqMsg!._id);
    expect(aqMsgError?.status).toBe("error");
    expect(aqMsgError?.error).toBe("Failed connection");

    // Since both messages are processed and one failed, the campaign status should be error
    const campaignFinishedError = await t.query(api.marketing.getMarketingCampaign, { campaignId });
    expect(campaignFinishedError?.status).toBe("error");
    expect(campaignFinishedError?.finishedAt).toBeDefined();

    // 6. Test reset failed messages
    const resetResult = await t.mutation(api.marketing.resetFailedMarketingMessages, { campaignId });
    expect(resetResult.resetCount).toBe(1);

    const resetMessages = await t.query(api.marketing.listCampaignMessages, { campaignId });
    const aqMsgReset = resetMessages.find(m => m._id === aqMsg!._id);
    expect(aqMsgReset?.status).toBe("pending");
    expect(aqMsgReset?.error).toBeUndefined();

    // Campaign should be ready again and finishedAt cleared
    const campaignReset = await t.query(api.marketing.getMarketingCampaign, { campaignId });
    expect(campaignReset?.status).toBe("ready");
    expect(campaignReset?.finishedAt).toBeUndefined();
  });
});
