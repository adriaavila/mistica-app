import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  students: defineTable({
    name: v.string(),
    phone: v.string(),
    dob: v.optional(v.string()),
    enrollmentDate: v.string(),
    modality: v.union(
      v.literal("lmv"),
      v.literal("mj"),
      v.literal("aquagym3x"),
      v.literal("aquagym5x"),
      v.literal("nat5x")
    ),
    timeSlotId: v.id("timeSlots"),
    secondTimeSlotId: v.optional(v.id("timeSlots")),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("withdrawn")
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    originalEnrollmentDate: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_modality", ["modality"])
    .index("by_timeSlot", ["timeSlotId"]),

  timeSlots: defineTable({
    label: v.string(),
    days: v.array(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    isActive: v.boolean(),
    maxCapacity: v.number(),
    modalities: v.array(v.string()),
  }).index("by_active", ["isActive"]),

  attendance: defineTable({
    studentId: v.id("students"),
    timeSlotId: v.id("timeSlots"),
    date: v.string(),
    present: v.boolean(),
    recordedAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_date_slot", ["date", "timeSlotId"])
    .index("by_student_date", ["studentId", "date"]),

  payments: defineTable({
    studentId: v.id("students"),
    type: v.union(v.literal("enrollment"), v.literal("monthly")),
    amount: v.number(),
    dueDate: v.string(),
    paidAt: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("overdue")
    ),
    notes: v.optional(v.string()),
    month: v.optional(v.string()),
    paymentMethod: v.optional(v.union(v.literal("qr"), v.literal("cash"))),
    paidAmount: v.optional(v.number()),
  })
    .index("by_student", ["studentId"])
    .index("by_status", ["status"])
    .index("by_due_date", ["dueDate"]),

  products: defineTable({
    name: v.string(),
    defaultPrice: v.number(),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

  sales: defineTable({
    productId: v.optional(v.id("products")),
    productName: v.string(),
    unitPrice: v.number(),
    quantity: v.number(),
    total: v.number(),
    date: v.string(),
    studentId: v.optional(v.id("students")),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_student", ["studentId"]),

  appConfig: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});
