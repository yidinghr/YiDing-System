export const ITO_CURRENCIES = Object.freeze(["HKD", "CNY", "USD", "VND"]);

export const ChipFamily = Object.freeze({
  NN: "NN",
  CC: "CC"
});

export const ChipCategory = Object.freeze({
  DPNN11: "DPNN11",
  DPNN13: "DPNN13",
  DPCC11: "DPCC11"
});

export const CageRole = Object.freeze({
  MAIN_CAGE: "MAIN_CAGE",
  ITO_CAGE: "ITO_CAGE"
});

export const LedgerAsset = Object.freeze({
  CASH: "CASH",
  NN_CHIP: "NN_CHIP",
  CC_CHIP: "CC_CHIP",
  CREDIT: "CREDIT",
  CONSUMPTION: "CONSUMPTION",
  ROLLING: "ROLLING"
});

export const LedgerDirection = Object.freeze({
  DEBIT: "DEBIT",
  CREDIT: "CREDIT"
});

export const SessionStatus = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SETTLEMENT_PENDING: "SETTLEMENT_PENDING",
  SETTLED: "SETTLED",
  VOIDED: "VOIDED"
});

export const BookingStatus = Object.freeze({
  REQUESTED: "REQUESTED",
  CONFIRMED: "CONFIRMED",
  POSTED: "POSTED",
  DISPUTED: "DISPUTED",
  SETTLED: "SETTLED",
  VOIDED: "VOIDED"
});

export const ApprovalStatus = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
});

export const DEFAULT_ROLLING_TARGET_HKD = 600000000;
export const DEFAULT_CHIP_RATIO = Object.freeze({ cash: 1, chip: 3 });
export const PALACE_WAN_SCALE = 10000;

