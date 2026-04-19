import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const sales = await ctx.db.query("sales").collect();
    const withDetails = await Promise.all(
      sales
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (sale) => {
          const student = sale.studentId
            ? await ctx.db.get(sale.studentId)
            : null;
          return { ...sale, student };
        })
    );
    return withDetails;
  },
});

export const create = mutation({
  args: {
    productId: v.optional(v.id("products")),
    productName: v.string(),
    unitPrice: v.number(),
    quantity: v.number(),
    studentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    return ctx.db.insert("sales", {
      ...args,
      total: args.unitPrice * args.quantity,
      date: today,
      createdAt: Date.now(),
    });
  },
});
