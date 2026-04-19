import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {
    status: v.optional(v.string()),
    modality: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();
    if (args.status) students = students.filter((s) => s.status === args.status);
    if (args.modality)
      students = students.filter((s) => s.modality === args.modality);
    return students.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("students") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const listWithDetails = query({
  args: {
    status: v.optional(v.string()),
    modality: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();
    if (args.status) students = students.filter((s) => s.status === args.status);
    if (args.modality)
      students = students.filter((s) => s.modality === args.modality);

    const today = new Date().toISOString().split("T")[0];

    const result = await Promise.all(
      students
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (student) => {
          const payments = await ctx.db
            .query("payments")
            .withIndex("by_student", (q) => q.eq("studentId", student._id))
            .collect();

          const latestMonthly = payments
            .filter((p) => p.type === "monthly")
            .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];

          let paymentStatus: "paid" | "pending" | "overdue" = "pending";
          if (latestMonthly) {
            if (latestMonthly.status === "paid") paymentStatus = "paid";
            else if (latestMonthly.dueDate < today) paymentStatus = "overdue";
            else paymentStatus = "pending";
          }

          const timeSlot = await ctx.db.get(student.timeSlotId);

          return {
            ...student,
            paymentStatus,
            latestPayment: latestMonthly ?? null,
            timeSlot,
          };
        })
    );

    return result;
  },
});

export const getWithDetails = query({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.id);
    if (!student) return null;

    const timeSlot = await ctx.db.get(student.timeSlotId);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_student", (q) => q.eq("studentId", args.id))
      .collect();

    const today = new Date().toISOString().split("T")[0];
    const sortedPayments = payments.sort((a, b) =>
      b.dueDate.localeCompare(a.dueDate)
    );
    const latestMonthly = sortedPayments.find((p) => p.type === "monthly");

    let paymentStatus: "paid" | "pending" | "overdue" = "pending";
    if (latestMonthly) {
      if (latestMonthly.status === "paid") paymentStatus = "paid";
      else if (latestMonthly.dueDate < today) paymentStatus = "overdue";
      else paymentStatus = "pending";
    }

    // Last 30 days attendance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("studentId", args.id))
      .collect();

    const recentAttendance = attendanceRecords
      .filter((a) => a.date >= thirtyDaysAgoStr)
      .sort((a, b) => b.date.localeCompare(a.date));

    const presentCount = recentAttendance.filter((a) => a.present).length;
    const attendanceRate =
      recentAttendance.length > 0
        ? Math.round((presentCount / recentAttendance.length) * 100)
        : null;

    return {
      ...student,
      timeSlot,
      payments: sortedPayments,
      paymentStatus,
      latestPayment: latestMonthly ?? null,
      attendanceRate,
      recentAttendance,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    dob: v.string(),
    enrollmentDate: v.string(),
    modality: v.union(
      v.literal("lmv"),
      v.literal("mj"),
      v.literal("aquagym3x"),
      v.literal("aquagym5x")
    ),
    timeSlotId: v.id("timeSlots"),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("withdrawn")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const studentId = await ctx.db.insert("students", {
      ...args,
      createdAt: Date.now(),
    });

    const modalityPriceKeys: Record<string, string> = {
      lmv: "price_lmv",
      mj: "price_mj",
      aquagym3x: "price_aquagym3x",
      aquagym5x: "price_aquagym5x",
    };

    const enrollmentConfig = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", "price_enrollment"))
      .first();
    const monthlyConfig = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) =>
        q.eq("key", modalityPriceKeys[args.modality])
      )
      .first();

    const enrollmentFee = enrollmentConfig
      ? parseFloat(enrollmentConfig.value)
      : 60;
    const defaultMonthly =
      args.modality === "mj" ? 220 : args.modality === "aquagym5x" ? 300 : 250;
    const monthlyFee = monthlyConfig
      ? parseFloat(monthlyConfig.value)
      : defaultMonthly;

    // Enrollment payment — paid on registration
    await ctx.db.insert("payments", {
      studentId,
      type: "enrollment",
      amount: enrollmentFee,
      dueDate: args.enrollmentDate,
      status: "paid",
      paidAt: args.enrollmentDate,
    });

    // First monthly payment due next month, same day as enrollment
    const enrollDate = new Date(args.enrollmentDate + "T00:00:00");
    const enrollDay = enrollDate.getDate();
    const dueDate = new Date(enrollDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    const lastDayOfNextMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
    dueDate.setDate(Math.min(enrollDay, lastDayOfNextMonth));
    const dueDateStr = dueDate.toISOString().split("T")[0];
    const monthStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;

    await ctx.db.insert("payments", {
      studentId,
      type: "monthly",
      amount: monthlyFee,
      dueDate: dueDateStr,
      status: "pending",
      month: monthStr,
    });

    return studentId;
  },
});

export const update = mutation({
  args: {
    id: v.id("students"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    dob: v.optional(v.string()),
    enrollmentDate: v.optional(v.string()),
    modality: v.optional(
      v.union(
        v.literal("lmv"),
        v.literal("mj"),
        v.literal("aquagym3x"),
        v.literal("aquagym5x")
      )
    ),
    timeSlotId: v.optional(v.id("timeSlots")),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("suspended"),
        v.literal("withdrawn")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Student not found");
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    // Remove related records
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_student", (q) => q.eq("studentId", args.id))
      .collect();
    for (const p of payments) await ctx.db.delete(p._id);

    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("studentId", args.id))
      .collect();
    for (const a of attendance) await ctx.db.delete(a._id);

    await ctx.db.delete(args.id);
  },
});
