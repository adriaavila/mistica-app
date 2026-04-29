import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByDateAndSlot = query({
  args: { date: v.string(), timeSlotId: v.id("timeSlots") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("attendance")
      .withIndex("by_date_slot", (q) =>
        q.eq("date", args.date).eq("timeSlotId", args.timeSlotId)
      )
      .collect();
  },
});

export const listByStudent = query({
  args: { studentId: v.id("students"), month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let records = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    if (args.month) {
      records = records.filter((r) => r.date.startsWith(args.month!));
    }
    return records.sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const upsert = mutation({
  args: {
    studentId: v.id("students"),
    timeSlotId: v.id("timeSlots"),
    date: v.string(),
    present: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", args.date)
      )
      .filter((q) => q.eq(q.field("timeSlotId"), args.timeSlotId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        present: args.present,
        recordedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("attendance", { ...args, recordedAt: Date.now() });
    }
  },
});

export const getStudentsForSlot = query({
  args: { timeSlotId: v.id("timeSlots"), date: v.string() },
  handler: async (ctx, args) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_timeSlot", (q) => q.eq("timeSlotId", args.timeSlotId))
      .collect();

    const activeStudents = students.filter((s) => s.status === "active");

    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_date_slot", (q) =>
        q.eq("date", args.date).eq("timeSlotId", args.timeSlotId)
      )
      .collect();

    const attendanceMap = new Map(attendance.map((a) => [a.studentId, a]));

    const today = new Date().toISOString().split("T")[0];

    const enriched = await Promise.all(
      activeStudents
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (student) => {
          const payments = await ctx.db
            .query("payments")
            .withIndex("by_student", (q) => q.eq("studentId", student._id))
            .collect();
          const monthly = payments
            .filter((p) => p.type === "monthly")
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          const unpaid = monthly.filter((p) => p.status !== "paid");

          let nextDue: { dueDate: string; status: string } | null = null;
          if (unpaid.length > 0) {
            const next = unpaid[0];
            nextDue = {
              dueDate: next.dueDate,
              status: next.dueDate < today ? "overdue" : next.status,
            };
          } else if (monthly.length > 0) {
            const lastPaid = monthly[monthly.length - 1];
            const enrollDay = new Date(student.enrollmentDate + "T00:00:00").getDate();
            const cur = new Date(lastPaid.dueDate + "T00:00:00");
            const nd = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
            const lastDay = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
            nd.setDate(Math.min(enrollDay, lastDay));
            const ds = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`;
            nextDue = { dueDate: ds, status: "paid" };
          }

          return {
            ...student,
            attendance: attendanceMap.get(student._id) ?? null,
            nextDue,
          };
        })
    );

    return enriched;
  },
});

export const getTodaySummary = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const slots = await ctx.db
      .query("timeSlots")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const todayDay = new Date(args.date + "T12:00:00").toLocaleDateString(
      "en-US",
      { weekday: "short" }
    );

    const todaySlots = slots.filter((s) => s.days.includes(todayDay));

    const result = await Promise.all(
      todaySlots
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map(async (slot) => {
          const students = await ctx.db
            .query("students")
            .withIndex("by_timeSlot", (q) => q.eq("timeSlotId", slot._id))
            .collect();
          const activeCount = students.filter(
            (s) => s.status === "active"
          ).length;

          const attendance = await ctx.db
            .query("attendance")
            .withIndex("by_date_slot", (q) =>
              q.eq("date", args.date).eq("timeSlotId", slot._id)
            )
            .collect();
          const presentCount = attendance.filter((a) => a.present).length;

          return {
            ...slot,
            activeStudents: activeCount,
            presentCount,
            recorded: attendance.length > 0,
          };
        })
    );

    return result;
  },
});
