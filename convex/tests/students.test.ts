import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { makeTest, seedTimeSlot, seedPrices, STUDENT_BASE, type TestInstance } from "./helpers";

let t: TestInstance;

beforeEach(() => {
  t = makeTest();
});

describe("students.create", () => {
  it("inserts student and creates 2 payments (enrollment + monthly)", async () => {
    await seedPrices(t);
    const slotId = await seedTimeSlot(t);

    const studentId = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      timeSlotId: slotId,
    });

    expect(studentId).toBeDefined();

    const payments = await t.query(api.payments.listByStudent, { studentId });
    expect(payments).toHaveLength(2);

    const enrollment = payments.find((p) => p.type === "enrollment");
    const monthly = payments.find((p) => p.type === "monthly");

    expect(enrollment).toBeDefined();
    expect(enrollment!.status).toBe("paid");
    expect(enrollment!.amount).toBe(60);

    expect(monthly).toBeDefined();
    expect(monthly!.status).toBe("pending");
    expect(monthly!.amount).toBe(250);
  });

  it("monthly payment due date is one month after enrollment", async () => {
    await seedPrices(t);
    const slotId = await seedTimeSlot(t);

    const studentId = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      enrollmentDate: "2024-03-15",
      timeSlotId: slotId,
    });

    const payments = await t.query(api.payments.listByStudent, { studentId });
    const monthly = payments.find((p) => p.type === "monthly");

    expect(monthly!.dueDate).toBe("2024-04-15");
    expect(monthly!.month).toBe("2024-04");
  });

  it("uses default price when appConfig missing", async () => {
    const slotId = await seedTimeSlot(t);

    const studentId = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      modality: "mj",
      timeSlotId: slotId,
    });

    const payments = await t.query(api.payments.listByStudent, { studentId });
    const monthly = payments.find((p) => p.type === "monthly");
    expect(monthly!.amount).toBe(220); // default for mj
  });
});

describe("students.remove", () => {
  it("cascade-deletes payments and attendance", async () => {
    await seedPrices(t);
    const slotId = await seedTimeSlot(t);

    const studentId = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      timeSlotId: slotId,
    });

    // Add an attendance record
    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId: slotId,
      date: "2024-03-18",
      present: true,
    });

    await t.mutation(api.students.remove, { id: studentId });

    // Student gone
    const student = await t.query(api.students.get, { id: studentId });
    expect(student).toBeNull();

    // Payments gone
    const payments = await t.query(api.payments.listByStudent, { studentId });
    expect(payments).toHaveLength(0);

    // Attendance gone
    const attendance = await t.query(api.attendance.listByStudent, { studentId });
    expect(attendance).toHaveLength(0);
  });
});

describe("students.list", () => {
  it("filters by status", async () => {
    await seedPrices(t);
    const slotId = await seedTimeSlot(t);

    const id1 = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Active One",
      timeSlotId: slotId,
    });
    await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Withdrawn One",
      status: "withdrawn",
      timeSlotId: slotId,
    });

    const active = await t.query(api.students.list, { status: "active" });
    expect(active.every((s) => s.status === "active")).toBe(true);
    expect(active.find((s) => s._id === id1)).toBeDefined();
  });
});
