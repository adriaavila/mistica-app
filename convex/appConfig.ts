import { v } from "convex/values";
import { mutation, query } from "./lib/auth";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db.query("appConfig").collect();
    return Object.fromEntries(configs.map((c) => [c.key, c.value]));
  },
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return config?.value ?? null;
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("appConfig", args);
    }
  },
});

export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      { key: "school_name", value: "Mística" },
      { key: "currency", value: "Bs" },
      { key: "price_enrollment", value: "60" },
      { key: "alert_days_before_due", value: "7" },
      { key: "payment_due_day", value: "1" },
      { key: "show_overdue_alert", value: "true" },
      { key: "show_expiry_alert", value: "true" },
      { key: "auto_mark_absent", value: "false" },
      { key: "editable_past_days", value: "7" },
    ];

    for (const item of defaults) {
      const existing = await ctx.db
        .query("appConfig")
        .withIndex("by_key", (q) => q.eq("key", item.key))
        .first();
      if (!existing) {
        await ctx.db.insert("appConfig", item);
      }
    }

    // Seed classes if they don't exist
    const classDefaults = [
      { key: "lmv", name: "Natación LMV", description: "Mensualidad Lun-Mié-Vie", price: 250, isActive: true, days: ["Mon", "Wed", "Fri"], startTime: "15:00", endTime: "18:00" },
      { key: "mj", name: "Natación MJ", description: "Mensualidad Mar-Jue", price: 220, isActive: true, days: ["Tue", "Thu"], startTime: "15:00", endTime: "18:00" },
      { key: "aquagym3x", name: "Aqua Gym 3x", description: "Mensualidad 3 veces/semana", price: 250, isActive: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "15:00", endTime: "18:00" },
      { key: "aquagym5x", name: "Aqua Gym 5x", description: "Mensualidad 5 veces/semana", price: 300, isActive: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "15:00", endTime: "18:00" },
      { key: "nat5x", name: "Natación 5 días", description: "Mensualidad 5 días/semana", price: 400, isActive: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "15:00", endTime: "18:00" },
    ];

    for (const item of classDefaults) {
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
