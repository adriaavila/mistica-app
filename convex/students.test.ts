import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

async function createTimeSlot(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) =>
    ctx.db.insert("timeSlots", {
      label: "LMV 3-4 pm",
      days: ["Mon", "Wed", "Fri"],
      startTime: "15:00",
      endTime: "16:00",
      isActive: true,
      maxCapacity: 20,
      modalities: ["lmv"],
    })
  );
}

describe("students", () => {
  it("prevents duplicate names when creating or updating students", async () => {
    const t = convexTest(schema);
    const timeSlotId = await createTimeSlot(t);

    const firstId = await t.mutation(api.students.create, {
      name: "María García",
      phone: "04121234567",
      enrollmentDate: "2026-06-12",
      modality: "lmv",
      timeSlotId,
      status: "active",
    });

    await expect(
      t.mutation(api.students.create, {
        name: "  MARIA   GARCIA  ",
        phone: "04127654321",
        enrollmentDate: "2026-06-12",
        modality: "lmv",
        timeSlotId,
        status: "active",
      })
    ).rejects.toThrow("Ya existe un alumno con ese nombre.");

    const secondId = await t.mutation(api.students.create, {
      name: "Laura Pinto",
      phone: "04120000000",
      enrollmentDate: "2026-06-12",
      modality: "lmv",
      timeSlotId,
      status: "active",
    });

    await expect(
      t.mutation(api.students.update, {
        id: secondId,
        name: "maria garcia",
      })
    ).rejects.toThrow("Ya existe un alumno con ese nombre.");

    await t.mutation(api.students.update, {
      id: firstId,
      name: " María García ",
    });

    const first = await t.query(api.students.get, { id: firstId });
    expect(first?.name).toBe("María García");
  });

  it("marks students as withdrawn when their class is set to inactive", async () => {
    const t = convexTest(schema);
    const timeSlotId = await createTimeSlot(t);

    // Create a class
    const classId = await t.run(async (ctx) =>
      ctx.db.insert("classes", {
        key: "lmv",
        name: "Natación LMV",
        description: "Mensualidad Lun-Mié-Vie",
        price: 250,
        isActive: true,
        days: ["Mon", "Wed", "Fri"],
        startTime: "15:00",
        endTime: "18:00",
      })
    );

    // Create active students in that class
    const student1Id = await t.mutation(api.students.create, {
      name: "María García",
      phone: "04121234567",
      enrollmentDate: "2026-06-12",
      modality: "lmv",
      timeSlotId,
      status: "active",
    });

    const student2Id = await t.mutation(api.students.create, {
      name: "Laura Pinto",
      phone: "04120000000",
      enrollmentDate: "2026-06-12",
      modality: "lmv",
      timeSlotId,
      status: "suspended",
    });

    // An active student in a different class
    const student3Id = await t.mutation(api.students.create, {
      name: "Pedro Pérez",
      phone: "04121111111",
      enrollmentDate: "2026-06-12",
      modality: "mj",
      timeSlotId,
      status: "active",
    });

    // Make the class inactive
    await t.mutation(api.classes.update, {
      id: classId,
      isActive: false,
    });

    // Verify student statuses
    const student1 = await t.query(api.students.get, { id: student1Id });
    const student2 = await t.query(api.students.get, { id: student2Id });
    const student3 = await t.query(api.students.get, { id: student3Id });

    expect(student1?.status).toBe("withdrawn");
    expect(student2?.status).toBe("withdrawn");
    expect(student3?.status).toBe("active");
  });

  it("deletes pending payments but preserves paid and overdue ones when student is set to withdrawn", async () => {
    const t = convexTest(schema);
    const timeSlotId = await createTimeSlot(t);

    const studentId = await t.mutation(api.students.create, {
      name: "María García",
      phone: "04121234567",
      enrollmentDate: "2026-06-12",
      modality: "lmv",
      timeSlotId,
      status: "active",
    });

    // Create a paid, a future pending, and two overdue payments
    const paidPaymentId = await t.run(async (ctx) =>
      ctx.db.insert("payments", {
        studentId,
        type: "enrollment",
        amount: 60,
        dueDate: "2026-06-12",
        status: "paid",
        paidAt: "2026-06-12",
      })
    );

    const futurePendingPaymentId = await t.run(async (ctx) =>
      ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: "2029-12-31", // Far in the future
        status: "pending",
      })
    );

    const pastPendingPaymentId = await t.run(async (ctx) =>
      ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: "2026-05-12", // In the past relative to 2026-06-23
        status: "pending",
      })
    );

    const explicitOverduePaymentId = await t.run(async (ctx) =>
      ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: 250,
        dueDate: "2026-05-12",
        status: "overdue",
      })
    );

    // Update status to withdrawn
    await t.mutation(api.students.update, {
      id: studentId,
      status: "withdrawn",
    });

    // Verify payments
    const paidPayment = await t.run(async (ctx) => ctx.db.get(paidPaymentId));
    const futurePendingPayment = await t.run(async (ctx) => ctx.db.get(futurePendingPaymentId));
    const pastPendingPayment = await t.run(async (ctx) => ctx.db.get(pastPendingPaymentId));
    const explicitOverduePayment = await t.run(async (ctx) => ctx.db.get(explicitOverduePaymentId));

    expect(paidPayment).not.toBeNull();
    expect(paidPayment?.status).toBe("paid");
    expect(futurePendingPayment).toBeNull();
    expect(pastPendingPayment).not.toBeNull();
    expect(explicitOverduePayment).not.toBeNull();
  });

  it("reactivates withdrawn students when their class is set to active", async () => {
    const t = convexTest(schema);
    const timeSlotId = await createTimeSlot(t);

    // Create a class
    const classId = await t.run(async (ctx) =>
      ctx.db.insert("classes", {
        key: "lmv",
        name: "Natación LMV",
        description: "Mensualidad Lun-Mié-Vie",
        price: 250,
        isActive: false, // Starts inactive
        days: ["Mon", "Wed", "Fri"],
        startTime: "15:00",
        endTime: "18:00",
      })
    );

    // Create a withdrawn student in that class
    const student1Id = await t.mutation(api.students.create, {
      name: "María García",
      phone: "04121234567",
      enrollmentDate: "2026-06-12",
      modality: "lmv",
      timeSlotId,
      status: "withdrawn",
    });

    // A withdrawn student in a different class
    const student2Id = await t.mutation(api.students.create, {
      name: "Pedro Pérez",
      phone: "04121111111",
      enrollmentDate: "2026-06-12",
      modality: "mj",
      timeSlotId,
      status: "withdrawn",
    });

    // Make the class active
    await t.mutation(api.classes.update, {
      id: classId,
      isActive: true,
    });

    // Verify student statuses
    const student1 = await t.query(api.students.get, { id: student1Id });
    const student2 = await t.query(api.students.get, { id: student2Id });

    expect(student1?.status).toBe("active");
    expect(student2?.status).toBe("withdrawn"); // Remains withdrawn since modality is different
  });
});
