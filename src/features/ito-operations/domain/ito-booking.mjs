import { BookingStatus } from "./ito-constants.mjs";

export function normalizeWhatsAppMessage(raw) {
  return Object.freeze({
    source: String(raw.source || "whatsapp"),
    externalId: String(raw.externalId || raw.id || ""),
    accountNumber: String(raw.accountNumber || ""),
    guestName: String(raw.guestName || ""),
    phone: String(raw.phone || raw.from || ""),
    direction: raw.direction === "out" ? "out" : "in",
    body: String(raw.body || raw.text || raw.message || "").trim(),
    timestamp: raw.timestamp || raw.ts || raw.time || "",
    attachments: Array.isArray(raw.attachments) ? raw.attachments.slice() : []
  });
}

export function createBookingTask(input) {
  const task = {
    id: String(input.id || ""),
    accountNumber: String(input.accountNumber || ""),
    tripId: String(input.tripId || ""),
    serviceType: String(input.serviceType || ""),
    status: input.status || BookingStatus.REQUESTED,
    requestedAt: input.requestedAt || new Date().toISOString(),
    scheduledAt: input.scheduledAt || "",
    vendor: String(input.vendor || ""),
    estimatedAmount: Number(input.estimatedAmount || 0),
    confirmedAmount: Number(input.confirmedAmount || 0),
    currency: String(input.currency || "HKD"),
    evidenceMessageIds: Array.isArray(input.evidenceMessageIds) ? input.evidenceMessageIds.slice() : [],
    note: String(input.note || "")
  };

  if (!task.accountNumber) {
    throw new Error("Booking task requires accountNumber.");
  }
  if (!task.serviceType) {
    throw new Error("Booking task requires serviceType.");
  }
  if (task.estimatedAmount < 0 || task.confirmedAmount < 0) {
    throw new Error("Booking amounts must be zero or positive.");
  }

  return Object.freeze(task);
}

export function buildConsumptionChargeFromBooking(task) {
  const amount = task.confirmedAmount || task.estimatedAmount;
  if (!amount) {
    throw new Error("Cannot post a zero booking charge.");
  }
  return Object.freeze({
    accountNumber: task.accountNumber,
    tripId: task.tripId,
    bookingTaskId: task.id,
    type: "BOOKING",
    subType: task.serviceType,
    amount,
    currency: task.currency,
    status: BookingStatus.POSTED,
    evidenceMessageIds: task.evidenceMessageIds.slice(),
    remark: task.note
  });
}

