import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("payments")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect()
      .then((p) => p.sort((a, b) => b.dueDate.localeCompare(a.dueDate)));
  },
});

export const listAll = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    let payments = await ctx.db.query("payments").collect();

    // Compute effective status
    payments = payments.map((p) => ({
      ...p,
      status:
        p.status !== "paid" && p.dueDate < today
          ? ("overdue" as const)
          : p.status,
    }));

    if (args.status) payments = payments.filter((p) => p.status === args.status);

    const withStudents = await Promise.all(
      payments
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map(async (payment) => {
          const student = await ctx.db.get(payment.studentId);
          return { ...payment, student };
        })
    );
    return withStudents;
  },
});

export const markPaid = mutation({
  args: {
    id: v.id("payments"),
    paidAt: v.optional(v.string()),
    paymentMethod: v.optional(v.union(v.literal("qr"), v.literal("cash"))),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const payment = await ctx.db.get(args.id);
    if (!payment) return;

    await ctx.db.patch(args.id, {
      status: "paid",
      paidAt: args.paidAt ?? today,
      paymentMethod: args.paymentMethod,
    });

    if (payment.type === "monthly") {
      const student = await ctx.db.get(payment.studentId);
      if (!student) return;
      const enrollDay = new Date(student.enrollmentDate + "T00:00:00").getDate();
      const currentDue = new Date(payment.dueDate + "T00:00:00");
      const nextDue = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, 1);
      const lastDay = new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0).getDate();
      nextDue.setDate(Math.min(enrollDay, lastDay));
      const nextDueStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}-${String(nextDue.getDate()).padStart(2, "0")}`;
      const nextMonthStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}`;
      const existing = await ctx.db
        .query("payments")
        .withIndex("by_student", (q) => q.eq("studentId", payment.studentId))
        .collect()
        .then((ps) => ps.find((p) => p.type === "monthly" && p.month === nextMonthStr));
      if (!existing) {
        await ctx.db.insert("payments", {
          studentId: payment.studentId,
          type: "monthly",
          amount: payment.amount,
          dueDate: nextDueStr,
          status: "pending",
          month: nextMonthStr,
        });
      }
    }
  },
});

export const addPartialPayment = mutation({
  args: {
    id: v.id("payments"),
    amount: v.number(),
    paymentMethod: v.optional(v.union(v.literal("qr"), v.literal("cash"))),
    paidAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const payment = await ctx.db.get(args.id);
    if (!payment) return;

    const newPaidAmount = (payment.paidAmount ?? 0) + args.amount;

    if (newPaidAmount >= payment.amount) {
      await ctx.db.patch(args.id, {
        paidAmount: newPaidAmount,
        paymentMethod: args.paymentMethod,
        status: "paid",
        paidAt: args.paidAt ?? today,
      });
      if (payment.type === "monthly") {
        const student = await ctx.db.get(payment.studentId);
        if (!student) return;
        const enrollDay = new Date(student.enrollmentDate + "T00:00:00").getDate();
        const currentDue = new Date(payment.dueDate + "T00:00:00");
        const nextDue = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, 1);
        const lastDay = new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0).getDate();
        nextDue.setDate(Math.min(enrollDay, lastDay));
        const nextDueStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}-${String(nextDue.getDate()).padStart(2, "0")}`;
        const nextMonthStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}`;
        const existing = await ctx.db
          .query("payments")
          .withIndex("by_student", (q) => q.eq("studentId", payment.studentId))
          .collect()
          .then((ps) => ps.find((p) => p.type === "monthly" && p.month === nextMonthStr));
        if (!existing) {
          await ctx.db.insert("payments", {
            studentId: payment.studentId,
            type: "monthly",
            amount: payment.amount,
            dueDate: nextDueStr,
            status: "pending",
            month: nextMonthStr,
          });
        }
      }
    } else {
      await ctx.db.patch(args.id, {
        paidAmount: newPaidAmount,
        paymentMethod: args.paymentMethod,
      });
    }
  },
});

export const markPending = mutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "pending", paidAt: undefined });
  },
});

export const create = mutation({
  args: {
    studentId: v.id("students"),
    type: v.union(v.literal("enrollment"), v.literal("monthly")),
    amount: v.number(),
    dueDate: v.string(),
    notes: v.optional(v.string()),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("payments", { ...args, status: "pending" });
  },
});

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    const alertConfig = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", "alert_days_before_due"))
      .first();
    const alertDays = alertConfig ? parseInt(alertConfig.value) : 7;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + alertDays);
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const allPayments = await ctx.db.query("payments").collect();
    const activeStudents = await ctx.db
      .query("students")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

const overdueCount = allPayments.filter(
  (p) => p.status !== "paid" && p.dueDate < today
).length;

const overdueEnrollmentCount = allPayments.filter(
  (p) => p.type === "enrollment" && p.status !== "paid" && p.dueDate < today
).length;

const expiringSoon = allPayments.filter(
      (p) =>
        p.status !== "paid" &&
        p.dueDate >= today &&
        p.dueDate <= futureDateStr
    ).length;

    const thisMonth = today.substring(0, 7);
    const collectedThisMonth = allPayments
      .filter(
        (p) => p.status === "paid" && p.paidAt && p.paidAt.startsWith(thisMonth)
      )
      .reduce((sum, p) => sum + p.amount, 0);

return {
  activeStudents: activeStudents.length,
  overdueCount,
  overdueEnrollmentCount,
  expiringSoon,
  collectedThisMonth,
};
  },
});

export const getAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const [allPayments, allStudents, allSlots, allAttendance, allSales] = await Promise.all([
      ctx.db.query("payments").collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("timeSlots").collect(),
      ctx.db.query("attendance").collect(),
      ctx.db.query("sales").collect(),
    ]);

    const activeStudents = allStudents.filter((s) => s.status === "active");

    // Monthly revenue last 6 months (paid payments)
    const monthlyRevenue: { month: string; total: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const paidThisMonth = allPayments.filter(
        (p) => p.status === "paid" && p.paidAt && p.paidAt.startsWith(ym)
      );
      monthlyRevenue.push({
        month: ym,
        total: paidThisMonth.reduce((s, p) => s + p.amount, 0),
        count: paidThisMonth.length,
      });
    }

    // Payments breakdown (current state of monthly payments)
    const thisMonth = todayStr.substring(0, 7);
    let paid = 0, pending = 0, overdue = 0;
for (const p of allPayments) {
  if (p.type === "enrollment") {
    if (p.status !== "paid" && p.dueDate < todayStr) overdue++;
    continue;
  }
  if (p.type !== "monthly") continue;
  if (p.status === "paid" && p.paidAt?.startsWith(thisMonth)) paid++;
  else if (p.status !== "paid" && p.dueDate < todayStr) overdue++;
  else if (p.status !== "paid" && p.dueDate.startsWith(thisMonth)) pending++;
}

    // Modality distribution (active students)
    const modalityCounts: Record<string, number> = {
      lmv: 0, mj: 0, aquagym3x: 0, aquagym5x: 0, nat5x: 0,
    };
    for (const s of activeStudents) modalityCounts[s.modality] = (modalityCounts[s.modality] ?? 0) + 1;

    // Attendance last 14 days
    const attendanceByDate: Record<string, { present: number; absent: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      attendanceByDate[ds] = { present: 0, absent: 0 };
    }
    for (const a of allAttendance) {
      if (attendanceByDate[a.date]) {
        if (a.present) attendanceByDate[a.date].present++;
        else attendanceByDate[a.date].absent++;
      }
    }
    const attendanceTrend = Object.entries(attendanceByDate).map(([date, v]) => ({
      date, present: v.present, absent: v.absent,
    }));

    // Sales last 30 days
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().split("T")[0];
    const recentSales = allSales.filter((s) => s.date >= thirtyStr);
    const salesTotal = recentSales.reduce((s, x) => s + x.total, 0);

    // Occupancy per active slot
    const activeSlots = allSlots.filter((s) => s.isActive);
    const occupancy = activeSlots
      .map((slot) => {
        const count = activeStudents.filter((s) => s.timeSlotId === slot._id).length;
        return {
          label: slot.label,
          startTime: slot.startTime,
          activeStudents: count,
          maxCapacity: slot.maxCapacity,
          pct: slot.maxCapacity > 0 ? Math.round((count / slot.maxCapacity) * 100) : 0,
        };
      })
      .sort((a, b) => b.pct - a.pct);

    // Totals
    const totalExpected = allPayments
      .filter((p) => p.type === "monthly" && p.dueDate.startsWith(thisMonth))
      .reduce((s, p) => s + p.amount, 0);
    const totalCollected = monthlyRevenue[monthlyRevenue.length - 1]?.total ?? 0;
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

    // New students per month (last 6 months)
    const newStudentsByMonth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = allStudents.filter((s) => s.enrollmentDate?.startsWith(ym)).length;
      newStudentsByMonth.push({ month: ym, count });
    }

    return {
      activeCount: activeStudents.length,
      totalStudents: allStudents.length,
      suspendedCount: allStudents.filter((s) => s.status === "suspended").length,
      withdrawnCount: allStudents.filter((s) => s.status === "withdrawn").length,
      monthlyRevenue,
      paymentsBreakdown: { paid, pending, overdue },
      modalityCounts,
      attendanceTrend,
      salesLast30Days: { total: salesTotal, count: recentSales.length },
      occupancy,
      totalExpected,
      totalCollected,
      collectionRate,
      newStudentsByMonth,
    };
  },
});

export const generateMonthly = mutation({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const activeStudents = await ctx.db
      .query("students")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const configs = await ctx.db.query("appConfig").collect();
    const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    const priceMap: Record<string, number> = {
      lmv: parseFloat(configMap.price_lmv ?? "0"),
      mj: parseFloat(configMap.price_mj ?? "0"),
      aquagym3x: parseFloat(configMap.price_aquagym3x ?? "0"),
      aquagym5x: parseFloat(configMap.price_aquagym5x ?? "0"),
      nat5x: parseFloat(configMap.price_nat5x ?? "0"),
    };

    const [year, month] = args.month.split("-").map(Number);
    let created = 0;

    for (const student of activeStudents) {
      const existing = await ctx.db
        .query("payments")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect()
        .then((ps) => ps.find((p) => p.type === "monthly" && p.month === args.month));

      if (existing) continue;

      const price = priceMap[student.modality] ?? 0;
      if (price === 0) continue;

      const enrollDay = new Date(student.enrollmentDate + "T00:00:00").getDate();
      const lastDay = new Date(year, month, 0).getDate();
      const dueDate = `${args.month}-${String(Math.min(enrollDay, lastDay)).padStart(2, "0")}`;

      await ctx.db.insert("payments", {
        studentId: student._id,
        type: "monthly",
        amount: price,
        dueDate,
        status: "pending",
        month: args.month,
      });
      created++;
    }
    return { created };
  },
});

export const backfillMissingMonths = mutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const todayMonth = today.substring(0, 7);
    const students = await ctx.db.query("students").collect();
    let created = 0;
    for (const student of students) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();
      const monthly = payments
        .filter((p) => p.type === "monthly" && p.month)
        .sort((a, b) => a.month!.localeCompare(b.month!));
      if (monthly.length === 0) continue;
      const earliest = monthly[0].month!;
      const latest = monthly[monthly.length - 1].month!;
      const endMonth = latest > todayMonth ? latest : todayMonth;
      const enrollDay = new Date(student.enrollmentDate + "T00:00:00").getDate();
      const baseAmount = monthly[monthly.length - 1].amount;
      const have = new Set(monthly.map((p) => p.month!));
      const [sy, sm] = earliest.split("-").map(Number);
      const [ey, em] = endMonth.split("-").map(Number);
      let y = sy, m = sm;
      while (y < ey || (y === ey && m <= em)) {
        const mStr = `${y}-${String(m).padStart(2, "0")}`;
        if (!have.has(mStr)) {
          const lastDay = new Date(y, m, 0).getDate();
          const dueDate = `${mStr}-${String(Math.min(enrollDay, lastDay)).padStart(2, "0")}`;
          await ctx.db.insert("payments", {
            studentId: student._id,
            type: "monthly",
            amount: baseAmount,
            dueDate,
            status: "pending",
            month: mStr,
          });
          created++;
        }
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }
    return { created };
  },
});

export const remove = mutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (existing) await ctx.db.delete(args.id);
  },
});

export const listOverdue = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const payments = await ctx.db.query("payments").collect();
    const overdue = payments.filter((p) => p.status !== "paid" && p.dueDate < today);
    return Promise.all(
      overdue.map(async (p) => {
        const student = await ctx.db.get(p.studentId);
        return { ...p, student };
      })
    );
  },
});

export const updateOverdueStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const pending = await ctx.db
      .query("payments")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    for (const p of pending) {
      if (p.dueDate < today) {
        await ctx.db.patch(p._id, { status: "overdue" });
      }
    }
  },
});
