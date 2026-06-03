import { palaceDisplayAmountToApiAmount } from "../domain/ito-rules.mjs";

export const PALACE_PROXY_BASE = "/api/palace";

export const PalaceOperation = Object.freeze({
  DEPOSIT: "deposit",
  WITHDRAW: "withdraw",
  TRANSFER: "transfer",
  GAME_START: "gameStart",
  CREDIT_OUT: "creditOut",
  CREDIT_REPAY: "creditRepay",
  CONSUMPTION: "consumption"
});

export function palaceProxyPath(path) {
  const cleanPath = String(path || "");
  return PALACE_PROXY_BASE + (cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`);
}

export function palaceSessionPath(sessionId, action) {
  if (!sessionId) {
    throw new Error("Palace session id is required.");
  }
  if (!action) {
    throw new Error("Palace session action is required.");
  }
  return `/game-sessions/${encodeURIComponent(sessionId)}/${action}`;
}

export function palaceLegacySessionPath(sessionId, action) {
  if (!sessionId) {
    throw new Error("Palace session id is required.");
  }
  const routeByAction = {
    settle: "settle",
    mid: "mid-exchange",
    tip: "tip"
  };
  const route = routeByAction[action];
  if (!route) {
    throw new Error("Unknown Palace legacy session action.");
  }
  return `/dashboard/chip-conversion/${route}?session=${encodeURIComponent(sessionId)}`;
}

export function buildPalaceTipPayload(input) {
  const amountNn = Number(input.amountNn || 0);
  const amountCc = Number(input.amountCc || 0);
  if (amountNn + amountCc <= 0) {
    throw new Error("Tip requires NN or CC amount.");
  }
  return Object.freeze({
    amountNn: palaceDisplayAmountToApiAmount(amountNn),
    amountCc: palaceDisplayAmountToApiAmount(amountCc),
    targetType: input.targetType || "STAFF"
  });
}

export function buildPalaceMidExchangePayload(input) {
  const kind = input.kind || "CASH_OUT";
  const amountNn = Number(input.amountNn || 0);
  const amountCc = Number(input.amountCc || 0);
  const creditRepayAmount = Number(input.creditRepayAmount || 0);
  if (amountNn + amountCc + creditRepayAmount <= 0) {
    throw new Error("Mid-exchange requires NN, CC or credit repay amount.");
  }
  return Object.freeze({
    kind,
    amountNn: palaceDisplayAmountToApiAmount(amountNn),
    amountCc: palaceDisplayAmountToApiAmount(amountCc),
    creditRepayAmount: palaceDisplayAmountToApiAmount(creditRepayAmount),
    isCreditRepayOnly: kind === "CREDIT_REPAY"
  });
}

export function buildPalaceSettlementPayload(input) {
  return Object.freeze({
    remainingNn: Number(input.remainingNn || 0),
    remainingCc: Number(input.remainingCc || 0),
    settleCashOut: Number(input.settleCashOut || 0),
    settleToAccount: Number(input.settleToAccount || 0),
    tipNn: Number(input.tipNn || 0),
    tipCc: Number(input.tipCc || 0),
    tipTargetType: input.tipTargetType || "STAFF",
    remarks: String(input.remarks || "").trim(),
    creditRepayAmount: Number(input.creditRepayAmount || 0)
  });
}

