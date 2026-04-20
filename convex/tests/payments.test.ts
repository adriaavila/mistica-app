import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { makeTest, seedTimeSlot, seedPrices, STUDENT_BASE, type TestInstance } from "./helpers";

let t: TestInstance;

beforeEach(() => {
  t = makeTest();
});

async function createStudent(t: TestInstance, overrides: Partial<typeof STUDENT_BASE> = {}) {
  await seedPrices(t);
  const slotId = await seedTimeSlot(t);
  const studentId = await t.mutation(api.students.create, {
    ...STUDENT_BASE,
    ...overrides,
    timeSlotId: slotId,
  });
  return { studentId, slotId };
}

describe("payments.markPaid", () => {
  it("marks payment paid and auto-creates next monthly", async () => {
    const { studentId } = await createStudent(t);

    const payments = await t.query(api.payments.listByStudent, { studentId });
    const monthly = payments.find((p) => p.type === "monthly")!;
    expect(monthly.month).toBe("2024-04");

    await t.mutation(api.payments.markPaid, { id: monthly._id });

    const updated = await t.query(api.payments.listByStudent, { studentId });
    const paid = updated.find((p) => p._id === monthly._id)!;
    expect(paid.status).toBe("paid");

    // Next monthly auto-created
    const monthlyPayments = updated.filter((p) => p.type === "monthly");
    expect(monthlyPayments).toHaveLength(2);

    const next = monthlyPayments.find((p) => p.month === "2024-05")!;
    expect(next).toBeDefined();
    expect(next.status).toBe("pending");
    expect(next.dueDate).toBe("2024-05-15");
    expect(next.amount).toBe(monthly.amount);
  });

  it("does not create duplicate next monthly if already exists", async () => {
    const { studentId } = await createStudent(t);

    const payments = await t.query(api.payments.listByStudent, { studentId });
    const monthly = payments.find((p) => p.type === "monthly")!;

    // Mark paid twice
    await t.mutation(api.payments.markPaid, { id: monthly._id });
    await t.mutation(api.payments.markPaid, { id: monthly._id });

    const updated = await t.query(api.payments.listByStudent, { studentId });
    const nextMonthly = updated.filter((p) => p.type === "monthly" && p.month === "2024-05");
    expect(nextMonthly).toHaveLength(1);
  });

  it("uses provided paidAt date", async () => {
    const { studentId } = await createStudent(t);
    const payments = await t.query(api.payments.listByStudent, { studentId });
    const monthly = payments.find((p) => p.type === "monthly")!;

    await t.mutation(api.payments.markPaid, {
      id: monthly._id,
      paidAt: "2024-04-10",
    });

    const updated = await t.query(api.payments.listByStudent, { studentId });
    const paid = updated.find((p) => p._id === monthly._id)!;
    expect(paid.paidAt).toBe("2024-04-10");
  });
});

describe("payments.markPending", () => {
  it("reverts paid payment to pending", async () => {
    const { studentId } = await createStudent(t);
    const payments = await t.query(api.payments.listByStudent, { studentId });
    const monthly = payments.find((p) => p.type === "monthly")!;

    await t.mutation(api.payments.markPaid, { id: monthly._id });
    await t.mutation(api.payments.markPending, { id: monthly._id });

    const updated = await t.query(api.payments.listByStudent, { studentId });
    const reverted = updated.find((p) => p._id === monthly._id)!;
    expect(reverted.status).toBe("pending");
    expect(reverted.paidAt).toBeUndefined();
  });
});

describe("payments.generateMonthly", () => {
  it("creates monthly payments for all active students", async () => {
    const slotId = await seedTimeSlot(t);
    await seedPrices(t);

    const id1 = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Student A",
      enrollmentDate: "2024-02-10",
      timeSlotId: slotId,
    });
    const id2 = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Student B",
      enrollmentDate: "2024-02-20",
      timeSlotId: slotId,
    });

    const result = await t.mutation(api.payments.generateMonthly, {
      month: "2024-05",
    });
    expect(result.created).toBe(2);

    for (const studentId of [id1, id2]) {
      const ps = await t.query(api.payments.listByStudent, { studentId });
      const may = ps.find((p) => p.month === "2024-05");
      expect(may).toBeDefined();
      expect(may!.status).toBe("pending");
      expect(may!.amount).toBe(250);
    }
  });

  it("skips students that already have a payment for the month", async () => {
    const { studentId } = await createStudent(t);

    // First call
    await t.mutation(api.payments.generateMonthly, { month: "2024-06" });
    // Second call — should skip
    const result = await t.mutation(api.payments.generateMonthly, { month: "2024-06" });
    expect(result.created).toBe(0);

    const ps = await t.query(api.payments.listByStudent, { studentId });
    expect(ps.filter((p) => p.month === "2024-06")).toHaveLength(1);
  });

  it("skips inactive students", async () => {
    const slotId = await seedTimeSlot(t);
    await seedPrices(t);

    await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Withdrawn",
      status: "withdrawn",
      timeSlotId: slotId,
    });

    const result = await t.mutation(api.payments.generateMonthly, { month: "2024-07" });
    expect(result.created).toBe(0);
  });
});

describe("payments.updateOverdueStatuses", () => {
  it("marks past-due pending payments as overdue", async () => {
    const slotId = await seedTimeSlot(t);

    // Insert a payment manually with a past due date
    const studentId = await t.run(async (ctx) => {
      return ctx.db.insert("students", {
        ...STUDENT_BASE,
        timeSlotId: slotId,
        createdAt: Date.now(),
      });
    });
    const paymentId = await t.run(async (ctx) => {
      return ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: "2023-01-15", // past
        status: "pending",
        month: "2023-01",
      });
    });

    await t.mutation(api.payments.updateOverdueStatuses, {});

    const payment = await t.run(async (ctx) => ctx.db.get(paymentId));
    expect(payment!.status).toBe("overdue");
  });
});

describe("payments.getDashboardStats", () => {
  it("returns correct active student count", async () => {
    const slotId = await seedTimeSlot(t);
    await seedPrices(t);

    await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Active 1",
      timeSlotId: slotId,
    });
    await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Active 2",
      timeSlotId: slotId,
    });

    const stats = await t.query(api.payments.getDashboardStats, {});
    expect(stats.activeStudents).toBe(2);
  });
});
