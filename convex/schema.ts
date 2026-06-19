import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  students: defineTable({
    name: v.string(),
    phone: v.string(),
    photo: v.optional(v.string()),
    dob: v.optional(v.string()),
    enrollmentDate: v.string(),
    modality: v.string(),
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
    payerPhone: v.optional(v.string()),
    guardianPhone: v.optional(v.string()),
    guardianName: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_modality", ["modality"])
    .index("by_timeSlot", ["timeSlotId"]),

  classes: defineTable({
    key: v.string(),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    isActive: v.boolean(),
    days: v.array(v.string()),
    startTime: v.string(),
    endTime: v.string(),
  }).index("by_key", ["key"])
    .index("by_active", ["isActive"]),

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

  permits: defineTable({
    studentId: v.id("students"),
    startDate: v.string(),
    endDate: v.string(),
    days: v.number(),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_student", ["studentId"]),

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

  marketingCampaigns: defineTable({
    name: v.string(),
    type: v.string(), // e.g. mothers_day
    segment: v.union(v.literal("natacion"), v.literal("aquagym"), v.literal("all")),
    messageTemplate: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    imageMimeType: v.optional(v.string()),
    imageFileName: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("sending"),
      v.literal("paused"),
      v.literal("done"),
      v.literal("error")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"]),

  marketingMessages: defineTable({
    campaignId: v.id("marketingCampaigns"),
    studentId: v.optional(v.id("students")),
    recipientName: v.optional(v.string()),
    studentName: v.optional(v.string()),
    phone: v.string(),
    normalizedPhone: v.string(),
    program: v.union(v.literal("natacion"), v.literal("aquagym"), v.literal("unknown")),
    message: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("error"),
      v.literal("skipped")
    ),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_phone", ["campaignId", "normalizedPhone"])
    .index("by_status", ["status"]),
});
