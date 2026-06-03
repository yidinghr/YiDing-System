import {
  ApprovalStatus,
  BookingStatus,
  SessionStatus
} from "./ito-constants.mjs";

export const SessionAction = Object.freeze({
  ACTIVATE: "ACTIVATE",
  ADD_ON: "ADD_ON",
  MID_EXCHANGE: "MID_EXCHANGE",
  TIP: "TIP",
  REQUEST_SETTLEMENT: "REQUEST_SETTLEMENT",
  SETTLE: "SETTLE",
  VOID: "VOID"
});

export const BookingAction = Object.freeze({
  CONFIRM: "CONFIRM",
  POST_CHARGE: "POST_CHARGE",
  DISPUTE: "DISPUTE",
  SETTLE: "SETTLE",
  VOID: "VOID"
});

const SESSION_TRANSITIONS = Object.freeze({
  [SessionStatus.DRAFT]: Object.freeze({
    [SessionAction.ACTIVATE]: SessionStatus.ACTIVE,
    [SessionAction.VOID]: SessionStatus.VOIDED
  }),
  [SessionStatus.ACTIVE]: Object.freeze({
    [SessionAction.ADD_ON]: SessionStatus.ACTIVE,
    [SessionAction.MID_EXCHANGE]: SessionStatus.ACTIVE,
    [SessionAction.TIP]: SessionStatus.ACTIVE,
    [SessionAction.REQUEST_SETTLEMENT]: SessionStatus.SETTLEMENT_PENDING,
    [SessionAction.SETTLE]: SessionStatus.SETTLED,
    [SessionAction.VOID]: SessionStatus.VOIDED
  }),
  [SessionStatus.SETTLEMENT_PENDING]: Object.freeze({
    [SessionAction.ADD_ON]: SessionStatus.ACTIVE,
    [SessionAction.SETTLE]: SessionStatus.SETTLED,
    [SessionAction.VOID]: SessionStatus.VOIDED
  }),
  [SessionStatus.SETTLED]: Object.freeze({}),
  [SessionStatus.VOIDED]: Object.freeze({})
});

const BOOKING_TRANSITIONS = Object.freeze({
  [BookingStatus.REQUESTED]: Object.freeze({
    [BookingAction.CONFIRM]: BookingStatus.CONFIRMED,
    [BookingAction.VOID]: BookingStatus.VOIDED
  }),
  [BookingStatus.CONFIRMED]: Object.freeze({
    [BookingAction.POST_CHARGE]: BookingStatus.POSTED,
    [BookingAction.DISPUTE]: BookingStatus.DISPUTED,
    [BookingAction.VOID]: BookingStatus.VOIDED
  }),
  [BookingStatus.POSTED]: Object.freeze({
    [BookingAction.SETTLE]: BookingStatus.SETTLED,
    [BookingAction.DISPUTE]: BookingStatus.DISPUTED,
    [BookingAction.VOID]: BookingStatus.VOIDED
  }),
  [BookingStatus.DISPUTED]: Object.freeze({
    [BookingAction.POST_CHARGE]: BookingStatus.POSTED,
    [BookingAction.SETTLE]: BookingStatus.SETTLED,
    [BookingAction.VOID]: BookingStatus.VOIDED
  }),
  [BookingStatus.SETTLED]: Object.freeze({}),
  [BookingStatus.VOIDED]: Object.freeze({})
});

export function getNextSessionStatus(status, action) {
  const next = SESSION_TRANSITIONS[status] && SESSION_TRANSITIONS[status][action];
  if (!next) {
    throw new Error(`Session action ${action} is not allowed from ${status}.`);
  }
  return next;
}

export function canRunSessionAction(status, action) {
  return Boolean(SESSION_TRANSITIONS[status] && SESSION_TRANSITIONS[status][action]);
}

export function getNextBookingStatus(status, action) {
  const next = BOOKING_TRANSITIONS[status] && BOOKING_TRANSITIONS[status][action];
  if (!next) {
    throw new Error(`Booking action ${action} is not allowed from ${status}.`);
  }
  return next;
}

export function canRunBookingAction(status, action) {
  return Boolean(BOOKING_TRANSITIONS[status] && BOOKING_TRANSITIONS[status][action]);
}

export function requiresApproval({ amount = 0, threshold = 0, role = "", riskFlag = false }) {
  if (riskFlag) {
    return ApprovalStatus.PENDING;
  }
  if (Number(amount) > Number(threshold || 0) && role !== "finance_manager" && role !== "owner") {
    return ApprovalStatus.PENDING;
  }
  return ApprovalStatus.NOT_REQUIRED;
}

