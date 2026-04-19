import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let slots = await ctx.db.query("timeSlots").collect();
    if (args.activeOnly) slots = slots.filter((s) => s.isActive);
    return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
});

export const get = query({
  args: { id: v.id("timeSlots") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const create = mutation({
  args: {
    label: v.string(),
    days: v.array(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    isActive: v.boolean(),
    maxCapacity: v.number(),
    modalities: v.array(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("timeSlots", args),
});

export const update = mutation({
  args: {
    id: v.id("timeSlots"),
    label: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    maxCapacity: v.optional(v.number()),
    modalities: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("timeSlots") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});

export const listWithCapacity = query({
  args: {},
  handler: async (ctx) => {
    const slots = await ctx.db
      .query("timeSlots")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const result = await Promise.all(
      slots
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map(async (slot) => {
          const students = await ctx.db
            .query("students")
            .withIndex("by_timeSlot", (q) => q.eq("timeSlotId", slot._id))
            .collect();
          const studentCount = students.filter(
            (s) => s.status === "active"
          ).length;
          return { ...slot, studentCount };
        })
    );
    return result;
  },
});

export const seedDefaultSlots = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("timeSlots").collect();
    if (existing.length > 0) return;

    const defaultSlots = [
      {
        label: "LMV 3–4 pm",
        days: ["Mon", "Wed", "Fri"],
        startTime: "15:00",
        endTime: "16:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["lmv", "aquagym3x"],
      },
      {
        label: "LMV 4–5 pm",
        days: ["Mon", "Wed", "Fri"],
        startTime: "16:00",
        endTime: "17:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["lmv", "aquagym3x"],
      },
      {
        label: "LMV 5–6 pm",
        days: ["Mon", "Wed", "Fri"],
        startTime: "17:00",
        endTime: "18:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["lmv", "aquagym3x"],
      },
      {
        label: "MJ 3–4 pm",
        days: ["Tue", "Thu"],
        startTime: "15:00",
        endTime: "16:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["mj"],
      },
      {
        label: "MJ 4–5 pm",
        days: ["Tue", "Thu"],
        startTime: "16:00",
        endTime: "17:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["mj"],
      },
      {
        label: "MJ 5–6 pm",
        days: ["Tue", "Thu"],
        startTime: "17:00",
        endTime: "18:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["mj"],
      },
      {
        label: "AG5x 3–4 pm",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        startTime: "15:00",
        endTime: "16:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["aquagym5x"],
      },
      {
        label: "AG5x 4–5 pm",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        startTime: "16:00",
        endTime: "17:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["aquagym5x"],
      },
      {
        label: "AG5x 5–6 pm",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        startTime: "17:00",
        endTime: "18:00",
        isActive: true,
        maxCapacity: 15,
        modalities: ["aquagym5x"],
      },
    ];

    for (const slot of defaultSlots) {
      await ctx.db.insert("timeSlots", slot);
    }
  },
});
