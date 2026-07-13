import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

async function seedStudent(t: ReturnType<typeof convexTest>, enrollmentDate: string) {
  return t.run(async (ctx) => {
    const timeSlotId = await ctx.db.insert("timeSlots", {
      label: "LMV 3-4 pm",
      days: ["Mon", "Wed", "Fri"],
      startTime: "15:00",
      endTime: "16:00",
      isActive: true,
      maxCapacity: 20,
      modalities: ["lmv"],
    });
    return ctx.db.insert("students", {
      name: "María García",
      phone: "04121234567",
      enrollmentDate,
      modality: "lmv",
      timeSlotId,
      status: "active",
      createdAt: Date.now(),
    });
  });
}

async function studentPayments(t: ReturnType<typeof convexTest>, studentId: Id<"students">) {
  const payments = await t.run(async (ctx) => ctx.db.query("payments").collect());
  return payments.filter((p) => p.studentId === studentId);
}

async function monthlyMonths(t: ReturnType<typeof convexTest>, studentId: Id<"students">) {
  return (await studentPayments(t, studentId))
    .filter((p) => p.type === "monthly")
    .map((p) => p.month)
    .sort();
}

describe("payments", () => {
  it("markPaid creates the next consecutive month, including year rollover", async () => {
    const t = convexTest(schema);
    const studentId = await seedStudent(t, "2026-12-15");
    const paymentId = await t.run(async (ctx) =>
      ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: "2026-12-15",
        status: "pending",
        month: "2026-12",
      })
    );

    await t.mutation(api.payments.markPaid, { id: paymentId, paidAt: "2026-12-15" });

    expect(await monthlyMonths(t, studentId)).toEqual(["2026-12", "2027-01"]);
  });

  it("does not skip a month when a permit pushed dueDate past the month boundary", async () => {
    const t = convexTest(schema);
    // Permit shifted the billing anchor: enrolled Jun 25, +10 days → Jul 05.
    const studentId = await seedStudent(t, "2026-07-05");
    const paymentId = await t.run(async (ctx) =>
      ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: "2026-07-05", // June's payment, shifted from 2026-06-25
        status: "pending",
        month: "2026-06",
      })
    );

    await t.mutation(api.payments.markPaid, { id: paymentId, paidAt: "2026-07-05" });

    // Next month must be July (not August), due one month after the shifted date.
    const payments = await studentPayments(t, studentId);
    const next = payments.find((p) => p.status === "pending");
    expect(next?.month).toBe("2026-07");
    expect(next?.dueDate).toBe("2026-08-05");
    expect(await monthlyMonths(t, studentId)).toEqual(["2026-06", "2026-07"]);
  });

  it("reactivating a withdrawn student recreates the current month's payment", async () => {
    const t = convexTest(schema);
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const enroll = `${curMonth}-28`;
    const studentId = await seedStudent(t, enroll);
    await t.run(async (ctx) => {
      await ctx.db.insert("classes", {
        key: "lmv",
        name: "Natación LMV",
        description: "x",
        price: 250,
        isActive: true,
        days: ["Mon"],
        startTime: "15:00",
        endTime: "16:00",
      });
      await ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: `${curMonth}-28`,
        status: "pending",
        month: curMonth,
      });
    });

    // Withdraw: current-month pending payment is deleted.
    await t.mutation(api.students.update, { id: studentId, status: "withdrawn" });
    expect(await monthlyMonths(t, studentId)).toEqual([]);

    // Reactivate: current-month payment is recreated.
    await t.mutation(api.students.update, { id: studentId, status: "active" });
    expect(await monthlyMonths(t, studentId)).toEqual([curMonth]);
  });

  it("addPartialPayment completing the amount also creates the next consecutive month", async () => {
    const t = convexTest(schema);
    const studentId = await seedStudent(t, "2026-07-05");
    const paymentId = await t.run(async (ctx) =>
      ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: "2026-07-05",
        status: "pending",
        month: "2026-06",
        paidAmount: 100,
      })
    );

    await t.mutation(api.payments.addPartialPayment, {
      id: paymentId,
      amount: 150,
      paidAt: "2026-07-05",
    });

    expect(await monthlyMonths(t, studentId)).toEqual(["2026-06", "2026-07"]);
  });
});
