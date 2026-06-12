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
});
