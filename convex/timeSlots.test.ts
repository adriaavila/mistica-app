import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("timeSlots", () => {
  it("keeps new class schedules assignable and usable for attendance", async () => {
    const t = convexTest(schema);

    await t.mutation(api.classes.create, {
      key: "avanzada",
      name: "Natacion Avanzada",
      description: "Mensualidad avanzada",
      price: 300,
      isActive: true,
      days: ["Tue"],
      startTime: "17:00",
      endTime: "18:00",
    });

    const timeSlotId = await t.mutation(api.timeSlots.create, {
      label: "Avanzada 5-6 pm",
      days: ["Mon"],
      startTime: "16:00",
      endTime: "17:00",
      isActive: true,
      maxCapacity: 12,
      modalities: ["avanzada"],
    });

    await t.mutation(api.timeSlots.update, {
      id: timeSlotId,
      label: "Avanzada 6-7 pm",
      days: ["Tue"],
      startTime: "18:00",
      endTime: "19:00",
    });

    const activeSlots = await t.query(api.timeSlots.list, { activeOnly: true });
    expect(activeSlots).toMatchObject([
      {
        _id: timeSlotId,
        label: "Avanzada 6-7 pm",
        modalities: ["avanzada"],
      },
    ]);

    const studentId = await t.mutation(api.students.create, {
      name: "Ana Avanzada",
      phone: "04121234567",
      enrollmentDate: "2026-07-07",
      modality: "avanzada",
      timeSlotId,
      status: "active",
    });

    const summary = await t.query(api.attendance.getTodaySummary, {
      date: "2026-07-07",
    });
    expect(summary.map((s) => s._id)).toContain(timeSlotId);

    const students = await t.query(api.attendance.getStudentsForSlot, {
      timeSlotId,
      date: "2026-07-07",
    });
    expect(students.map((s) => s._id)).toEqual([studentId]);

    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId,
      date: "2026-07-07",
      present: true,
    });

    const attendance = await t.query(api.attendance.listByDateAndSlot, {
      timeSlotId,
      date: "2026-07-07",
    });
    expect(attendance).toMatchObject([{ studentId, present: true }]);
  });
});
