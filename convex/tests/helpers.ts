import { convexTest } from "convex-test";
import schema from "../schema";

export function makeTest() {
  return convexTest(schema);
}

export type TestInstance = ReturnType<typeof makeTest>;

/** Insert a minimal time slot and return its id */
export async function seedTimeSlot(t: TestInstance) {
  return t.run(async (ctx) => {
    return ctx.db.insert("timeSlots", {
      label: "LMV 08:00",
      days: ["Mon", "Wed", "Fri"],
      startTime: "08:00",
      endTime: "09:00",
      isActive: true,
      maxCapacity: 10,
      modalities: ["lmv"],
    });
  });
}

/** Insert appConfig price rows */
export async function seedPrices(t: TestInstance) {
  return t.run(async (ctx) => {
    const entries = [
      { key: "price_enrollment", value: "60" },
      { key: "price_lmv", value: "250" },
      { key: "price_mj", value: "220" },
      { key: "price_aquagym3x", value: "250" },
      { key: "price_aquagym5x", value: "300" },
    ];
    for (const e of entries) await ctx.db.insert("appConfig", e);
  });
}

export const STUDENT_BASE = {
  name: "Test Student",
  phone: "1234567890",
  dob: "1990-01-15",
  enrollmentDate: "2024-03-15",
  modality: "lmv" as const,
  status: "active" as const,
};
