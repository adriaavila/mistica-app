import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const listByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("permits")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect()
      .then((p) => p.sort((a, b) => b.startDate.localeCompare(a.startDate)));
  },
});

export const create = mutation({
  args: {
    studentId: v.id("students"),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) return;

    const start = new Date(args.startDate + "T00:00:00");
    const end = new Date(args.endDate + "T00:00:00");
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (days <= 0) return;

    // Move the billing anchor so all future months shift; keep antigüedad intact.
    const patch: { enrollmentDate: string; originalEnrollmentDate?: string } = {
      enrollmentDate: addDays(student.enrollmentDate, days),
    };
    if (!student.originalEnrollmentDate) {
      patch.originalEnrollmentDate = student.enrollmentDate;
    }
    await ctx.db.patch(args.studentId, patch);

    // Shift current unpaid monthly payments forward too.
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    for (const p of payments) {
      if (p.type === "monthly" && p.status !== "paid") {
        await ctx.db.patch(p._id, { dueDate: addDays(p.dueDate, days) });
      }
    }

    return ctx.db.insert("permits", {
      studentId: args.studentId,
      startDate: args.startDate,
      endDate: args.endDate,
      days,
      reason: args.reason,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("permits") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (existing) await ctx.db.delete(args.id);
  },
});
