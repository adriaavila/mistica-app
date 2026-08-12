import { internalMutation } from "./_generated/server";
import { mutation } from "./lib/auth";

export const markEnrollmentsPaid = internalMutation({
  args: {},
  handler: async (ctx) => {
    const payments = await ctx.db.query("payments").collect();
    const enrollments = payments.filter(
      (payment) => payment.type === "enrollment" && payment.status !== "paid",
    );
    for (const payment of enrollments) {
      await ctx.db.patch(payment._id, { status: "paid", paidAt: payment.dueDate });
    }
    return { updated: enrollments.length };
  },
});

export const clearStudents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    for (const student of students) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_student", (query) => query.eq("studentId", student._id))
        .collect();
      for (const payment of payments) await ctx.db.delete(payment._id);
      const attendance = await ctx.db
        .query("attendance")
        .withIndex("by_student", (query) => query.eq("studentId", student._id))
        .collect();
      for (const record of attendance) await ctx.db.delete(record._id);
      await ctx.db.delete(student._id);
    }
    return { deleted: students.length };
  },
});

// Production data is never seeded from source code. Existing deployments keep
// their database untouched; the initializer can safely call this during rollout.
export const seedStudents = mutation({
  args: {},
  handler: async () => ({ inserted: 0, retired: true }),
});
