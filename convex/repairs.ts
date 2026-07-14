import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Admin-only data repair, run via CLI:
//   npx convex run repairs:setPaymentMonth '{"id":"...","month":"2026-08","dueDate":"2026-08-25"}'
// Fixes month labels/dueDates corrupted by the pre-3e12934 month-skip bug.
export const setPaymentMonth = internalMutation({
  args: {
    id: v.id("payments"),
    month: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.id);
    if (!payment) throw new Error("payment not found");
    const patch: { month: string; dueDate?: string } = { month: args.month };
    if (args.dueDate) patch.dueDate = args.dueDate;
    await ctx.db.patch(args.id, patch);
    return { before: { month: payment.month, dueDate: payment.dueDate }, after: patch };
  },
});
