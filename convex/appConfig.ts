import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
      { key: "price_lmv", value: "250" },
      { key: "price_mj", value: "220" },
      { key: "price_aquagym3x", value: "250" },
      { key: "price_aquagym5x", value: "300" },
      { key: "price_nat5x", value: "400" },
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
  },
});
