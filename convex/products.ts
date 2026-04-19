import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let products = await ctx.db.query("products").collect();
    if (args.activeOnly) products = products.filter((p) => p.isActive);
    return products.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    defaultPrice: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => ctx.db.insert("products", args),
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    defaultPrice: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});
