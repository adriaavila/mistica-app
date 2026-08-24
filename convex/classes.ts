import { v } from "convex/values";
import { mutation, query } from "./lib/auth";
import { ensureCurrentMonthPayment } from "./paymentsLib";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let classes = await ctx.db.query("classes").collect();
    if (args.activeOnly) classes = classes.filter((c) => c.isActive);
    return classes.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("classes") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("classes")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const create = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    isActive: v.boolean(),
    days: v.array(v.string()),
    startTime: v.string(),
    endTime: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("classes", args);
    // Without a matching timeSlot the new class has no horario to assign, so it
    // never shows up when changing a student's schedule.
    await ctx.db.insert("timeSlots", {
      label: args.name,
      days: args.days,
      startTime: args.startTime,
      endTime: args.endTime,
      isActive: args.isActive,
      maxCapacity: 15,
      modalities: [args.key],
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("classes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    days: v.optional(v.array(v.string())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Class not found");
    }

    if (fields.isActive === false && existing.isActive) {
      const today = new Date().toISOString().split("T")[0];
      const students = await ctx.db
        .query("students")
        .withIndex("by_modality", (q) => q.eq("modality", existing.key))
        .collect();
      for (const student of students) {
        if (student.status !== "withdrawn") {
          await ctx.db.patch(student._id, { status: "withdrawn" });
          const payments = await ctx.db
            .query("payments")
            .withIndex("by_student", (q) => q.eq("studentId", student._id))
            .collect();
          for (const p of payments) {
            const isOverdue = p.status === "overdue" || (p.status === "pending" && p.dueDate < today);
            if (p.status !== "paid" && !isOverdue) {
              await ctx.db.delete(p._id);
            }
          }
        }
      }
    } else if (fields.isActive === true && existing.isActive === false) {
      const students = await ctx.db
        .query("students")
        .withIndex("by_modality", (q) => q.eq("modality", existing.key))
        .collect();
      for (const student of students) {
        if (student.status === "withdrawn") {
          await ctx.db.patch(student._id, { status: "active" });
          await ensureCurrentMonthPayment(ctx, student._id);
        }
      }
    }

    await ctx.db.patch(id, fields);
  },
});

// Backfill for classes created before create() started making their timeSlot.
export const ensureSlotsForClasses = mutation({
  args: {},
  handler: async (ctx) => {
    const classes = await ctx.db.query("classes").collect();
    const slots = await ctx.db.query("timeSlots").collect();
    const covered = new Set(slots.flatMap((s) => s.modalities));
    for (const cls of classes) {
      // nat5x is assigned through the lmv + mj slots, it never gets its own.
      if (cls.key === "nat5x" || covered.has(cls.key)) continue;
      await ctx.db.insert("timeSlots", {
        label: cls.name,
        days: cls.days,
        startTime: cls.startTime,
        endTime: cls.endTime,
        isActive: cls.isActive,
        maxCapacity: 15,
        modalities: [cls.key],
      });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("classes") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});

export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      { key: "lmv", name: "Natación LMV", description: "Mensualidad Lun-Mié-Vie", price: 250, isActive: true, days: ["Mon", "Wed", "Fri"], startTime: "15:00", endTime: "18:00" },
      { key: "mj", name: "Natación MJ", description: "Mensualidad Mar-Jue", price: 220, isActive: true, days: ["Tue", "Thu"], startTime: "15:00", endTime: "18:00" },
      { key: "aquagym3x", name: "Aqua Gym 3x", description: "Mensualidad 3 veces/semana", price: 250, isActive: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "15:00", endTime: "18:00" },
      { key: "aquagym5x", name: "Aqua Gym 5x", description: "Mensualidad 5 veces/semana", price: 300, isActive: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "15:00", endTime: "18:00" },
      { key: "nat5x", name: "Natación 5 días", description: "Mensualidad 5 días/semana", price: 400, isActive: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "15:00", endTime: "18:00" },
    ];

    for (const item of defaults) {
      const existing = await ctx.db
        .query("classes")
        .withIndex("by_key", (q) => q.eq("key", item.key))
        .first();
      if (!existing) {
        await ctx.db.insert("classes", item);
      }
    }
  },
});
