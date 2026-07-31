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

  whatsappConnections: defineTable({
    connectionId: v.string(),
    provider: v.literal("waha"),
    workspaceKey: v.string(),
    wahaSessionId: v.string(),
    phone: v.optional(v.string()),
    status: v.string(),
    lastWebhookAt: v.optional(v.number()),
    lastInboundAt: v.optional(v.number()),
    lastOutboundAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    connectedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_connectionId", ["connectionId"])
    .index("by_workspace", ["workspaceKey"])
    .index("by_wahaSessionId", ["wahaSessionId"]),

  whatsappRawEvents: defineTable({
    // Optional keeps schema rollout compatible with any raw events written by
    // an earlier deployment while all new events are connection-scoped.
    connectionId: v.optional(v.string()),
    providerEventId: v.string(),
    requestId: v.optional(v.string()),
    eventType: v.string(),
    payload: v.any(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("PROCESSING"),
      v.literal("PROCESSED"),
      v.literal("FAILED"),
      v.literal("SKIPPED")
    ),
    attempts: v.number(),
    error: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_connection_event", ["connectionId", "providerEventId"])
    .index("by_status_received", ["status", "receivedAt"]),

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
    // Nothing sends until a human approves. Unset = the scheduler will not pick it up.
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
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

  // --- CRM ---

  contacts: defineTable({
    connectionId: v.optional(v.string()),
    waChatId: v.string(),          // "59171234567@c.us" — join key to WhatsApp
    normalizedPhone: v.string(),
    displayName: v.string(),       // pushName from WAHA, editable
    kind: v.union(v.literal("cliente"), v.literal("interesado"), v.literal("otro")),
    linkedStudentIds: v.array(v.id("students")),
    stage: v.optional(v.union(     // interesados pipeline; unset for clientes
      v.literal("nuevo"),
      v.literal("contactado"),
      v.literal("clase_prueba"),
      v.literal("inscrito"),
      v.literal("perdido")
    )),
    lostReason: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_chatId", ["waChatId"])
    .index("by_connection_chatId", ["connectionId", "waChatId"])
    .index("by_phone", ["normalizedPhone"])
    .index("by_kind", ["kind"])
    .index("by_kind_stage", ["kind", "stage"]),

  conversations: defineTable({
    connectionId: v.optional(v.string()),
    contactId: v.id("contacts"),
    waChatId: v.string(),
    status: v.union(v.literal("abierta"), v.literal("pospuesta"), v.literal("cerrada")),
    lastMessageAt: v.number(),
    lastMessagePreview: v.string(),
    // Explicit: comparing lastInboundAt to lastMessageAt is ambiguous when a
    // reply lands in the same millisecond.
    lastMessageDirection: v.union(v.literal("in"), v.literal("out")),
    lastInboundAt: v.optional(v.number()),
    unreadCount: v.number(),
    humanTakeoverUntil: v.optional(v.number()),
    ownershipState: v.optional(v.union(
      v.literal("AGENT_ACTIVE"),
      v.literal("HUMAN_ACTIVE"),
      v.literal("PAUSED"),
      v.literal("CLOSED")
    )),
    agentSummary: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_contact", ["contactId"])
    .index("by_chatId", ["waChatId"])
    .index("by_connection_chatId", ["connectionId", "waChatId"])
    .index("by_status_recent", ["status", "lastMessageAt"]),

  messages: defineTable({
    connectionId: v.optional(v.string()),
    conversationId: v.id("conversations"),
    waMessageId: v.string(),       // WAHA payload.id — idempotency key
    direction: v.union(v.literal("in"), v.literal("out")),
    authorType: v.union(
      v.literal("contacto"),
      v.literal("humano"),
      v.literal("agente"),
      v.literal("sistema")
    ),
    body: v.string(),
    timestamp: v.number(),         // ms
    hasMedia: v.boolean(),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    mediaError: v.optional(v.string()),
    ack: v.optional(v.number()),   // 1 sent, 2 delivered, 3 read
    sendStatus: v.optional(v.union(
      v.literal("PENDING"),
      v.literal("SENT"),
      v.literal("AMBIGUOUS"),
      v.literal("FAILED")
    )),
    sendAttemptedAt: v.optional(v.number()),
    sendError: v.optional(v.string()),
    campaignId: v.optional(v.id("marketingCampaigns")),
  })
    .index("by_conversation", ["conversationId", "timestamp"])
    .index("by_waMessageId", ["waMessageId"])
    .index("by_connection_waMessageId", ["connectionId", "waMessageId"]),

  receipts: defineTable({
    messageId: v.id("messages"),
    contactId: v.id("contacts"),
    storageId: v.id("_storage"),
    status: v.union(v.literal("pendiente"), v.literal("aprobado"), v.literal("rechazado")),
    paymentId: v.optional(v.id("payments")),
    studentId: v.optional(v.id("students")),
    declaredAmount: v.optional(v.number()),
    reference: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    receivedAt: v.number(),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_status", ["status", "receivedAt"])
    .index("by_contact", ["contactId"])
    .index("by_payment", ["paymentId"]),
});
