const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function loadItoDomain() {
  const modulePath = path.resolve(__dirname, "../src/features/ito-operations/domain/index.mjs");
  return import(pathToFileURL(modulePath).href);
}

test.describe("ITO operations domain", () => {
  test("calculates configurable chip ratio without hard-coding UI assumptions", async () => {
    const domain = await loadItoDomain();

    expect(domain.calculateChipIssueAmount(100, { cash: 1, chip: 3 })).toBe(300);
    expect(domain.calculateDepositRequired(300, { cash: 1, chip: 3 })).toBe(100);
    expect(domain.calculateChipIssueAmount(125.5, { cash: 1, chip: 2 })).toBe(251);
  });

  test("tracks monthly rolling progress against the Hoiana working target", async () => {
    const domain = await loadItoDomain();

    const half = domain.calculateRollingProgress(300000000, domain.DEFAULT_ROLLING_TARGET_HKD);
    expect(half.target).toBe(600000000);
    expect(half.percent).toBe(50);
    expect(half.remaining).toBe(300000000);
    expect(half.achieved).toBe(false);

    const done = domain.calculateRollingProgress(600000000, domain.DEFAULT_ROLLING_TARGET_HKD);
    expect(done.achieved).toBe(true);
    expect(done.percent).toBe(100);
  });

  test("keeps Palace wan amount scaling explicit", async () => {
    const domain = await loadItoDomain();

    expect(domain.palaceDisplayAmountToApiAmount(0.01)).toBe(100);
    expect(domain.palaceDisplayAmountToApiAmount(1)).toBe(10000);
    expect(domain.palaceApiAmountToDisplayAmount(100)).toBe(0.01);
  });

  test("validates balanced ledger groups by ledger, asset and currency", async () => {
    const domain = await loadItoDomain();

    const entries = [
      domain.createLedgerEntry({
        accountId: "00008",
        cageId: "MAIN",
        ledgerId: "deposit-1",
        asset: domain.LedgerAsset.CASH,
        currency: "HKD",
        direction: domain.LedgerDirection.DEBIT,
        amount: 100,
        sourceType: "DEPOSIT",
        sourceId: "deposit-1"
      }),
      domain.createLedgerEntry({
        accountId: "00008",
        cageId: "ITO",
        ledgerId: "deposit-1",
        asset: domain.LedgerAsset.CASH,
        currency: "HKD",
        direction: domain.LedgerDirection.CREDIT,
        amount: 100,
        sourceType: "DEPOSIT",
        sourceId: "deposit-1"
      })
    ];

    expect(domain.validateBalancedLedger(entries).valid).toBe(true);
    expect(domain.validateBalancedLedger(entries.slice(0, 1)).valid).toBe(false);
  });

  test("blocks invalid session lifecycle actions", async () => {
    const domain = await loadItoDomain();

    expect(domain.canRunSessionAction(domain.SessionStatus.ACTIVE, domain.SessionAction.MID_EXCHANGE)).toBe(true);
    expect(domain.getNextSessionStatus(domain.SessionStatus.ACTIVE, domain.SessionAction.TIP)).toBe(domain.SessionStatus.ACTIVE);
    expect(domain.canRunSessionAction(domain.SessionStatus.SETTLED, domain.SessionAction.MID_EXCHANGE)).toBe(false);
    expect(() => domain.getNextSessionStatus(domain.SessionStatus.SETTLED, domain.SessionAction.TIP)).toThrow();
  });

  test("turns authorized booking tasks into consumption charge drafts", async () => {
    const domain = await loadItoDomain();

    const task = domain.createBookingTask({
      id: "bk-1",
      accountNumber: "00011",
      serviceType: "TRANSPORT",
      estimatedAmount: 80,
      confirmedAmount: 100,
      currency: "USD",
      evidenceMessageIds: ["wa-1"],
      note: "Airport pickup confirmed by booking hotline."
    });
    const charge = domain.buildConsumptionChargeFromBooking(task);

    expect(charge.accountNumber).toBe("00011");
    expect(charge.subType).toBe("TRANSPORT");
    expect(charge.amount).toBe(100);
    expect(charge.evidenceMessageIds).toEqual(["wa-1"]);
  });
});

