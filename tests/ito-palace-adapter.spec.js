const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function loadPalaceAdapter() {
  const modulePath = path.resolve(__dirname, "../src/features/ito-operations/adapters/palace-adapter.mjs");
  return import(pathToFileURL(modulePath).href);
}

test.describe("ITO Palace adapter", () => {
  test("builds stable proxy and legacy session paths", async () => {
    const adapter = await loadPalaceAdapter();

    expect(adapter.palaceProxyPath("/customers")).toBe("/api/palace/customers");
    expect(adapter.palaceSessionPath("session 1", "tip")).toBe("/game-sessions/session%201/tip");
    expect(adapter.palaceLegacySessionPath("session 1", "mid")).toBe("/dashboard/chip-conversion/mid-exchange?session=session%201");
  });

  test("builds Palace tip payload with explicit scaling", async () => {
    const adapter = await loadPalaceAdapter();

    expect(adapter.buildPalaceTipPayload({
      amountNn: 0.01,
      amountCc: 0,
      targetType: "STAFF"
    })).toEqual({
      amountNn: 100,
      amountCc: 0,
      targetType: "STAFF"
    });
    expect(() => adapter.buildPalaceTipPayload({ amountNn: 0, amountCc: 0 })).toThrow();
  });

  test("builds Palace mid-exchange payload with repay-only flag", async () => {
    const adapter = await loadPalaceAdapter();

    expect(adapter.buildPalaceMidExchangePayload({
      kind: "CREDIT_REPAY",
      amountNn: 0,
      amountCc: 0,
      creditRepayAmount: 0.01
    })).toEqual({
      kind: "CREDIT_REPAY",
      amountNn: 0,
      amountCc: 0,
      creditRepayAmount: 100,
      isCreditRepayOnly: true
    });
  });
});

