import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../_generated/api";
import { makeTest, seedTimeSlot, seedPrices, STUDENT_BASE, type TestInstance } from "./helpers";

let t: TestInstance;

beforeEach(() => {
  t = makeTest();
});

async function setupStudentAndSlot(t: TestInstance) {
  await seedPrices(t);
  const slotId = await seedTimeSlot(t);
  const studentId = await t.mutation(api.students.create, {
    ...STUDENT_BASE,
    timeSlotId: slotId,
  });
  return { studentId, slotId };
}

describe("attendance.upsert", () => {
  it("creates attendance record", async () => {
    const { studentId, slotId } = await setupStudentAndSlot(t);

    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId: slotId,
      date: "2024-03-18",
      present: true,
    });

    const records = await t.query(api.attendance.listByStudent, { studentId });
    expect(records).toHaveLength(1);
    expect(records[0].present).toBe(true);
    expect(records[0].date).toBe("2024-03-18");
  });

  it("updates existing record (idempotent)", async () => {
    const { studentId, slotId } = await setupStudentAndSlot(t);
    const date = "2024-03-18";

    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId: slotId,
      date,
      present: true,
    });
    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId: slotId,
      date,
      present: false,
    });

    const records = await t.query(api.attendance.listByStudent, { studentId });
    expect(records).toHaveLength(1); // still one record
    expect(records[0].present).toBe(false); // updated value
  });

  it("creates separate records for different dates", async () => {
    const { studentId, slotId } = await setupStudentAndSlot(t);

    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId: slotId,
      date: "2024-03-18",
      present: true,
    });
    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId: slotId,
      date: "2024-03-20",
      present: false,
    });

    const records = await t.query(api.attendance.listByStudent, { studentId });
    expect(records).toHaveLength(2);
  });
});

describe("attendance.listByStudent", () => {
  it("filters by month", async () => {
    const { studentId, slotId } = await setupStudentAndSlot(t);

    await t.mutation(api.attendance.upsert, {
      studentId, timeSlotId: slotId, date: "2024-03-18", present: true,
    });
    await t.mutation(api.attendance.upsert, {
      studentId, timeSlotId: slotId, date: "2024-04-01", present: true,
    });

    const march = await t.query(api.attendance.listByStudent, {
      studentId,
      month: "2024-03",
    });
    expect(march).toHaveLength(1);
    expect(march[0].date).toBe("2024-03-18");
  });
});

describe("attendance.getStudentsForSlot", () => {
  it("returns active students with attendance status", async () => {
    const { studentId, slotId } = await setupStudentAndSlot(t);
    const date = "2024-03-18";

    await t.mutation(api.attendance.upsert, {
      studentId,
      timeSlotId: slotId,
      date,
      present: true,
    });

    const result = await t.query(api.attendance.getStudentsForSlot, {
      timeSlotId: slotId,
      date,
    });

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe(studentId);
    expect(result[0].attendance?.present).toBe(true);
  });

  it("returns null attendance for student with no record on date", async () => {
    const { studentId, slotId } = await setupStudentAndSlot(t);

    const result = await t.query(api.attendance.getStudentsForSlot, {
      timeSlotId: slotId,
      date: "2024-03-18",
    });

    expect(result).toHaveLength(1);
    expect(result[0].attendance).toBeNull();
  });

  it("excludes withdrawn/suspended students", async () => {
    await seedPrices(t);
    const slotId = await seedTimeSlot(t);

    // Active
    await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Active",
      timeSlotId: slotId,
    });
    // Withdrawn
    await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Withdrawn",
      status: "withdrawn",
      timeSlotId: slotId,
    });

    const result = await t.query(api.attendance.getStudentsForSlot, {
      timeSlotId: slotId,
      date: "2024-03-18",
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Active");
  });
});

describe("attendance.getTodaySummary", () => {
  it("returns only slots that run on the given day", async () => {
    const slotId = await seedTimeSlot(t); // Mon/Wed/Fri slot

    // Monday
    const monResult = await t.query(api.attendance.getTodaySummary, {
      date: "2024-03-18", // Monday
    });
    expect(monResult.some((s) => s._id === slotId)).toBe(true);

    // Tuesday — slot should not appear
    const tueResult = await t.query(api.attendance.getTodaySummary, {
      date: "2024-03-19", // Tuesday
    });
    expect(tueResult.some((s) => s._id === slotId)).toBe(false);
  });

  it("counts present students correctly", async () => {
    await seedPrices(t);
    const slotId = await seedTimeSlot(t);
    const date = "2024-03-18"; // Monday

    const id1 = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Student A",
      timeSlotId: slotId,
    });
    const id2 = await t.mutation(api.students.create, {
      ...STUDENT_BASE,
      name: "Student B",
      timeSlotId: slotId,
    });

    await t.mutation(api.attendance.upsert, {
      studentId: id1, timeSlotId: slotId, date, present: true,
    });
    await t.mutation(api.attendance.upsert, {
      studentId: id2, timeSlotId: slotId, date, present: false,
    });

    const summary = await t.query(api.attendance.getTodaySummary, { date });
    const slot = summary.find((s) => s._id === slotId)!;

    expect(slot.activeStudents).toBe(2);
    expect(slot.presentCount).toBe(1);
    expect(slot.recorded).toBe(true);
  });
});
