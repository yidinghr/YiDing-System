import {
  DEFAULT_CHIP_RATIO,
  DEFAULT_ROLLING_TARGET_HKD,
  PALACE_WAN_SCALE
} from "./ito-constants.mjs";

export function assertPositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return number;
}

export function assertNonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be zero or positive.`);
  }
  return number;
}

export function calculateChipIssueAmount(depositAmount, ratio = DEFAULT_CHIP_RATIO) {
  const cash = assertPositiveNumber(ratio.cash, "ratio.cash");
  const chip = assertPositiveNumber(ratio.chip, "ratio.chip");
  const deposit = assertNonNegativeNumber(depositAmount, "depositAmount");
  return Math.round((deposit * chip / cash) * 100) / 100;
}

export function calculateDepositRequired(chipAmount, ratio = DEFAULT_CHIP_RATIO) {
  const cash = assertPositiveNumber(ratio.cash, "ratio.cash");
  const chip = assertPositiveNumber(ratio.chip, "ratio.chip");
  const amount = assertNonNegativeNumber(chipAmount, "chipAmount");
  return Math.round((amount * cash / chip) * 100) / 100;
}

export function calculateRollingProgress(actualRolling, targetRolling = DEFAULT_ROLLING_TARGET_HKD) {
  const actual = assertNonNegativeNumber(actualRolling, "actualRolling");
  const target = assertPositiveNumber(targetRolling, "targetRolling");
  const remaining = Math.max(0, target - actual);
  const percent = Math.min(100, Math.round((actual / target) * 10000) / 100);
  return {
    actual,
    target,
    remaining,
    percent,
    achieved: actual >= target
  };
}

export function palaceDisplayAmountToApiAmount(displayAmount) {
  const amount = assertNonNegativeNumber(displayAmount, "displayAmount");
  return Math.round(amount * PALACE_WAN_SCALE);
}

export function palaceApiAmountToDisplayAmount(apiAmount) {
  const amount = assertNonNegativeNumber(apiAmount, "apiAmount");
  return Math.round((amount / PALACE_WAN_SCALE) * 100) / 100;
}

export function buildSettlementPreview(input) {
  const principal = assertNonNegativeNumber(input.principalAmount || 0, "principalAmount");
  const remainingNn = assertNonNegativeNumber(input.remainingNn || 0, "remainingNn");
  const remainingCc = assertNonNegativeNumber(input.remainingCc || 0, "remainingCc");
  const cashOut = assertNonNegativeNumber(input.cashOut || 0, "cashOut");
  const depositBack = assertNonNegativeNumber(input.depositBack || 0, "depositBack");
  const creditRepay = assertNonNegativeNumber(input.creditRepay || 0, "creditRepay");
  const tip = assertNonNegativeNumber(input.tip || 0, "tip");
  const rollingAfter = assertNonNegativeNumber(input.rollingAfter || 0, "rollingAfter");

  return {
    principal,
    remainingNn,
    remainingCc,
    cashOut,
    depositBack,
    creditRepay,
    tip,
    rollingAfter,
    winLoss: Math.round((remainingNn + remainingCc + cashOut + depositBack + creditRepay + tip - principal) * 100) / 100
  };
}

