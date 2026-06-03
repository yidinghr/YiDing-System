const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function loadPalaceUi() {
  const modulePath = path.resolve(__dirname, "../src/features/ito-operations/ui/palace-render-helpers.mjs");
  return import(pathToFileURL(modulePath).href);
}

test.describe("ITO Palace UI helpers", () => {
  test("formats empty amounts and escapes unsafe text", async () => {
    const ui = await loadPalaceUi();

    expect(ui.formatPalaceAmount("")).toBe("—");
    expect(ui.formatPalaceAmount(null)).toBe("—");
    expect(ui.formatPalaceAmount("<script>")).toBe("&lt;script&gt;");
  });

  test("renders stable currency, operation and customer options", async () => {
    const ui = await loadPalaceUi();
    const customers = [
      { id: "cust-00008", accountNumber: "00008", displayName: "Light <Agent>" },
      { id: "cust-00009", accountNumber: "00009", displayName: "Kai-A Agent" }
    ];

    expect(ui.renderPalaceCurrencyOptions(["HKD", "USD"], "USD")).toContain('<option value="USD" selected>USD</option>');
    expect(ui.renderPalaceOperationButton("deposit", "Deposit", "deposit")).toContain("is-active");
    expect(ui.renderPalaceCustomerOptions(customers)).toContain("Light &lt;Agent&gt;");
    expect(ui.renderPalaceSessionCustomerOptions(customers, "cust-00009")).toContain('<option value="cust-00009" selected>00009 · Kai-A Agent</option>');
  });

  test("renders table rows with escaped values and numeric cells", async () => {
    const ui = await loadPalaceUi();
    const html = ui.renderPalaceRows(
      [{ accountNumber: "00008", amount: 100, note: "Light & Kai-A" }],
      [
        { key: "accountNumber" },
        { key: "amount", numeric: true },
        { value: (row) => row.note }
      ]
    );

    expect(html).toContain("<td>00008</td>");
    expect(html).toContain('<td class="palace-native-table__num">100</td>');
    expect(html).toContain("<td>Light &amp; Kai-A</td>");
  });

  test("renders operation-specific cage form fields", async () => {
    const ui = await loadPalaceUi();
    const customerOptions = '<option value="cust-00008">00008 · Light Agent</option>';
    const currencyOptions = '<option value="HKD">HKD</option><option value="USD">USD</option>';

    expect(ui.getPalaceOperationSubmitLabel("creditRepay")).toBe("Submit credit repay");
    expect(ui.renderPalaceOperationFields({
      operation: "transfer",
      customerOptionsHtml: customerOptions,
      currencyOptionsHtml: currencyOptions
    })).toContain('name="fromCustomerId"');

    const gameStartFields = ui.renderPalaceOperationFields({
      operation: "gameStart",
      customerOptionsHtml: customerOptions,
      currencyOptionsHtml: currencyOptions
    });
    expect(gameStartFields).toContain('name="mode"');
    expect(gameStartFields).toContain('name="chipCategory"');

    expect(ui.renderPalaceOperationFields({
      operation: "creditRepay",
      customerOptionsHtml: customerOptions,
      currencyOptionsHtml: currencyOptions
    })).toContain('name="creditType" value="repay"');

    const consumptionFields = ui.renderPalaceOperationFields({
      operation: "consumption",
      customerOptionsHtml: customerOptions,
      currencyOptionsHtml: currencyOptions
    });
    expect(consumptionFields).toContain('<option value="room">Room</option>');
    expect(consumptionFields).toContain('name="cashPaid"');
  });

  test("renders actionable credit and consumption rows", async () => {
    const ui = await loadPalaceUi();

    const creditHtml = ui.renderPalaceCreditRows([
      { id: "credit-1", accountNumber: "00009", displayName: "Kai-A <Agent>", type: "borrow", currency: "HKD", amount: 500, remark: "credit & cage", isVoid: false }
    ], { pending: true });
    expect(creditHtml).toContain("Kai-A &lt;Agent&gt;");
    expect(creditHtml).toContain('data-chat-action="palace-credit-void"');
    expect(creditHtml).toContain("disabled");

    const consumptionHtml = ui.renderPalaceConsumptionRows([
      { id: "consume-1", accountNumber: "00008", displayName: "Light Agent", type: "cash", subType: "room", currency: "USD", amount: 20, remark: "room charge", isSettled: false, isVoid: false }
    ]);
    expect(consumptionHtml).toContain("cash / room");
    expect(consumptionHtml).toContain('data-chat-action="palace-consumption-settle"');
    expect(consumptionHtml).toContain('data-chat-action="palace-consumption-void"');
  });

  test("renders session and settlement action rows", async () => {
    const ui = await loadPalaceUi();
    const formatDateTime = (value) => `fmt:${value}`;

    const sessionHtml = ui.renderPalaceSessionRows([
      {
        id: "session-1",
        accountNumber: "00008",
        displayName: "Light Agent",
        openingMode: "CASH",
        openingCurrency: "USD",
        openingAmount: 100,
        playableStack: 300,
        openedAt: "2026-06-03T08:00:00.000Z"
      }
    ], { pending: true, formatDateTime });
    expect(sessionHtml).toContain("fmt:2026-06-03T08:00:00.000Z");
    expect(sessionHtml).toContain('data-chat-action="palace-session-settle"');
    expect(sessionHtml).toContain('data-chat-action="palace-session-mid"');
    expect(sessionHtml).toContain("disabled");

    const settlementHtml = ui.renderPalaceSettlementRows([
      {
        id: "settle-1",
        settledAt: "2026-06-03T09:00:00.000Z",
        accountNumber: "00008",
        displayName: "Light Agent",
        guestSegment: "AGENT TEST",
        principalAmount: 100,
        rollingAfter: 180,
        cashOut: 20,
        depositBack: 10,
        creditRepay: 0,
        winLoss: -70,
        chipCategory: "DPNN11"
      }
    ], { detailLoading: true, formatDateTime });
    expect(settlementHtml).toContain("fmt:2026-06-03T09:00:00.000Z");
    expect(settlementHtml).toContain('data-chat-action="palace-settlement-view"');
    expect(settlementHtml).toContain('class="palace-native-table__num">-70</td>');
    expect(settlementHtml).toContain("disabled");
  });

  test("renders settlement filters and pager controls", async () => {
    const ui = await loadPalaceUi();

    const filtersHtml = ui.renderPalaceSettlementFiltersForm({
      period: "monthly",
      guest: "AGENT TEST",
      keyword: "Light <Kai-A>",
      operator: "admin & cage",
      from: "2026-06-01T00:00",
      to: "2026-06-03T23:59"
    }, { loading: true });

    expect(filtersHtml).toContain('<option value="monthly" selected>Monthly</option>');
    expect(filtersHtml).toContain('value="Light &lt;Kai-A&gt;"');
    expect(filtersHtml).toContain('value="admin &amp; cage"');
    expect(filtersHtml).toContain('data-chat-action="palace-settlement-reset" disabled');

    const pagerHtml = ui.renderPalaceSettlementPager({
      page: 2,
      totalPages: 4,
      total: 37,
      loading: false
    });

    expect(pagerHtml).toContain("Page 2 / 4 · total 37");
    expect(pagerHtml).toContain('data-page="1"');
    expect(pagerHtml).toContain('data-page="3"');
  });
});
