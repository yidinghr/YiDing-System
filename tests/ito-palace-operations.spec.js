const { test, expect } = require("@playwright/test");

const ACCOUNTS_KEY = "yiding_accounts_v1";
const SESSION_KEY = "yiding_auth_session_v1";
const TAB_KEY = "yiding_dashboard_active_tab_v2";

function seedAdminAuth(page) {
  return page.addInitScript(
    ({ accountsKey, sessionKey, tabKey }) => {
      const adminAccount = {
        username: "YiDing Admin",
        password: "YDI0006",
        role: "admin",
        displayName: "YiDing Admin",
        welcomeMessage: "燈哥",
        avatarSrc: "/image/logoweb.png",
        createdAt: "2026-04-13T00:00:00.000Z"
      };
      window.localStorage.setItem(accountsKey, JSON.stringify([adminAccount]));
      window.sessionStorage.setItem(sessionKey, JSON.stringify({
        username: adminAccount.username,
        role: adminAccount.role,
        displayName: adminAccount.displayName,
        welcomeMessage: adminAccount.welcomeMessage,
        avatarSrc: adminAccount.avatarSrc
      }));
      window.sessionStorage.setItem(`${tabKey}:${adminAccount.username}`, "palaceOperations");
    },
    { accountsKey: ACCOUNTS_KEY, sessionKey: SESSION_KEY, tabKey: TAB_KEY }
  );
}

function jsonResponse(payload, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  };
}

async function installPalaceMock(page) {
  let connected = false;
  const submissions = [];

  const customers = [
    { id: "cust-00008", accountNumber: "00008", displayName: "Light Agent" },
    { id: "cust-00009", accountNumber: "00009", displayName: "Kai-A Agent" }
  ];
  const gameSessions = [
    {
      id: "session-live-00008",
      customerId: "cust-00008",
      accountNumber: "00008",
      displayName: "Light Agent",
      guestSegment: "AGENT TEST",
      openingMode: "CASH",
      openingCurrency: "USD",
      openingAmount: 100,
      openingChipCategory: "DPNN11",
      playableStack: 300,
      currentRolling: 180,
      openedAt: "2026-06-03T08:00:00.000Z"
    }
  ];

  await page.route("**/api/palace/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/palace/, "") || "/";
    const method = request.method();

    if (path === "/login" && method === "POST") {
      connected = true;
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }

    if (path === "/auth/me") {
      await route.fulfill(connected
        ? jsonResponse({ operatorName: "Palace Mock Admin", staffAccount: "admin" })
        : jsonResponse({ message: "No Palace session" }, 401));
      return;
    }

    if (!connected) {
      await route.fulfill(jsonResponse({ message: "No Palace session" }, 401));
      return;
    }

    if (path === "/customers") {
      await route.fulfill(jsonResponse({ items: customers }));
      return;
    }

    if (path === "/transactions") {
      await route.fulfill(jsonResponse({
        items: [
          {
            id: "tx-1",
            accountNumber: "00008",
            customerName: "Light Agent",
            transactionType: "GAME_START",
            currency: "USD",
            amount: 100,
            remarks: "AGENT TEST - Light opened NN for Kai-A/Kai-B burst play."
          }
        ]
      }));
      return;
    }

    if (path === "/transactions/deposit" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true, id: `mock-${submissions.length}` }));
      return;
    }

    if (path === "/transactions/withdrawal" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true, id: `mock-${submissions.length}` }));
      return;
    }

    if (path === "/transactions/transfer" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true, id: `mock-${submissions.length}` }));
      return;
    }

    if (path === "/transactions/game-start" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true, id: `mock-${submissions.length}` }));
      return;
    }

    if (path === "/credit-records" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true, id: `mock-${submissions.length}` }));
      return;
    }

    if (path === "/credit-records/credit-1/void" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }

    if (path === "/credit-records" && method === "GET") {
      await route.fulfill(jsonResponse({
        records: [
          {
            id: "credit-1",
            accountNumber: "00009",
            displayName: "Kai-A Agent",
            type: "borrow",
            currency: "HKD",
            amount: 500,
            remark: "AGENT TEST - Kai-A credit line tied to Kai-B joint rolling.",
            isVoid: false
          }
        ]
      }));
      return;
    }

    if (path === "/consumption-records" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true, id: `mock-${submissions.length}` }));
      return;
    }

    if (path === "/consumption-records/consume-1/settle" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }

    if (path === "/consumption-records/consume-1/void" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }

    if (path === "/consumption-records" && method === "GET") {
      await route.fulfill(jsonResponse({
        records: [
          {
            id: "consume-1",
            accountNumber: "00008",
            displayName: "Light Agent",
            type: "cash",
            subType: "room",
            currency: "USD",
            amount: 20,
            remark: "AGENT TEST - Room charge posted by booking after Light/Kai-A stay.",
            isSettled: false,
            isVoid: false
          }
        ]
      }));
      return;
    }

    if (path === "/game-sessions") {
      const customerId = url.searchParams.get("customerId");
      await route.fulfill(jsonResponse({
        items: customerId ? gameSessions.filter((row) => row.customerId === customerId) : gameSessions
      }));
      return;
    }

    if (path === "/snapshots/game-settlement") {
      await route.fulfill(jsonResponse({
        rows: [
          {
            id: "settle-1",
            accountNumber: "00008",
            displayName: "Light Agent",
            guestSegment: "AGENT TEST",
            principalAmount: 100,
            rollingAfter: 180,
            cashOut: 20,
            depositBack: 10,
            creditRepay: 0,
            winLoss: -70,
            chipCategory: "DPNN11",
            settledAt: "2026-06-03T09:00:00.000Z"
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1,
        emptyLabel: "No settlement rows loaded yet."
      }));
      return;
    }

    if (path === "/game-sessions/session-live-00008/mid-exchange" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }

    if (path === "/game-sessions/session-live-00008/settle" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }

    if (path === "/game-sessions/session-live-00008/tip" && method === "POST") {
      submissions.push({ path, method, body: request.postDataJSON() });
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }

    if (path === "/settlement-records/settle-1") {
      await route.fulfill(jsonResponse({
        detail: {
          customer: {
            accountNumber: "00008",
            displayName: "Light Agent"
          },
          session: {
            id: "session-live-00008",
            openingChipCategory: "DPNN11"
          },
          settlementOperator: "Palace Mock Admin",
          settlementNotes: "AGENT TEST - Settlement detail links Light session to Kai-A shared rolling.",
          record: {
            id: "settle-1",
            accountNumber: "00008",
            displayName: "Light Agent",
            guestSegment: "AGENT TEST",
            principalAmount: 100,
            initialPrincipalAmount: 100,
            addOnAmount: 0,
            rollingAfter: 180,
            cashOut: 20,
            depositBack: 10,
            creditRepay: 0,
            winLoss: -70,
            chipCategory: "DPNN11",
            settledAt: "2026-06-03T09:00:00.000Z"
          },
          ledgerTransactions: [
            {
              id: "ledger-1",
              type: "SESSION_SETTLEMENT",
              currency: "USD",
              amount: 100,
              operatorName: "Palace Mock Admin",
              notes: "AGENT TEST - Ledger row ties Light/Kai-A session to cage settlement."
            }
          ]
        }
      }));
      return;
    }

    if (path === "/exports/transactions" || path === "/exports/settlement-records") {
      submissions.push({ path, method, body: null, query: url.search });
      await route.fulfill({
        status: 200,
        contentType: "text/csv",
        body: "account,amount\n00008,100\n"
      });
      return;
    }

    await route.fulfill(jsonResponse({ message: `Unhandled Palace mock route: ${method} ${path}` }, 404));
  });

  return submissions;
}

async function openConnectedPalace(page) {
  await page.goto("/home/home.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#dashboardMainButton-palaceOperations")).toHaveClass(/is-active/);
  await expect(page.locator("#palaceLoginForm")).toBeVisible();
  await page.locator("#palaceLoginForm [name='password']").fill("admin@123456");
  await page.locator("#palaceLoginForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#palaceOperationForm")).toBeVisible();
  await expect(page.locator("#dashboardChatBody")).toContainText("Active game sessions");
}

async function submitOperation(page, operation, fillForm) {
  await page.locator(`[data-palace-operation="${operation}"]`).click();
  await fillForm(page.locator("#palaceOperationForm"));
  await page.locator("#palaceOperationForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#dashboardChatBody")).toContainText("Operation submitted to Palace.");
  await expect(page.locator("#palaceOperationForm button[type='submit']")).toBeEnabled();
}

test.describe("YiDing ITO Palace Operations", () => {
  test("connects to mocked Palace and submits active-session mid-exchange and tip", async ({ page }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedAdminAuth(page);
    const submissions = await installPalaceMock(page);

    await openConnectedPalace(page);
    await expect(page.locator("#dashboardChatBody")).toContainText("00008");
    await expect(page.locator("#dashboardChatBody")).toContainText("AGENT TEST");

    await page.locator('[data-chat-action="palace-session-mid"][data-session-id="session-live-00008"]').click();
    await expect(page.locator("#palaceSessionMidForm")).toBeVisible();
    await expect(page.locator("#dashboardChatBody")).toContainText("Mid-exchange");
    await page.locator('#palaceSessionMidForm [name="amountCc"]').fill("0.01");
    await page.locator("#palaceSessionMidForm").evaluate((form) => form.requestSubmit());
    await expect(page.locator("#dashboardChatBody")).toContainText("Mid-exchange registered through Palace endpoint.");

    await expect(page.locator('[data-chat-action="palace-session-tip"][data-session-id="session-live-00008"]')).toBeVisible();
    await page.locator('[data-chat-action="palace-session-tip"][data-session-id="session-live-00008"]').click();
    await expect(page.locator("#palaceSessionTipForm")).toBeVisible();
    await page.locator('#palaceSessionTipForm [name="amountNn"]').fill("0.02");
    await page.locator('#palaceSessionTipForm [name="targetType"]').selectOption("DEALER");
    await page.locator("#palaceSessionTipForm").evaluate((form) => form.requestSubmit());
    await expect(page.locator("#dashboardChatBody")).toContainText("Tip registered through Palace endpoint.");

    expect(submissions.find((entry) => entry.path === "/login")).toBeTruthy();
    expect(submissions.find((entry) => entry.path.endsWith("/mid-exchange")).body).toEqual({
      kind: "CASH_OUT",
      amountNn: 0,
      amountCc: 100,
      creditRepayAmount: 0,
      isCreditRepayOnly: false
    });
    expect(submissions.find((entry) => entry.path.endsWith("/tip")).body).toEqual({
      amountNn: 200,
      amountCc: 0,
      targetType: "DEALER"
    });
  });

  test("submits core cage operations with Palace-shaped payloads", async ({ page }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedAdminAuth(page);
    const submissions = await installPalaceMock(page);

    await openConnectedPalace(page);

    await submitOperation(page, "deposit", async (form) => {
      await form.locator('[name="customerId"]').selectOption("cust-00008");
      await form.locator('[name="amount"]').fill("300");
      await form.locator('[name="currency"]').selectOption("HKD");
      await form.locator('[name="remarks"]').fill("AGENT TEST - Front money from Light before Kai-A shared rolling.");
    });

    await submitOperation(page, "withdraw", async (form) => {
      await form.locator('[name="customerId"]').selectOption("cust-00008");
      await form.locator('[name="amount"]').fill("50");
      await form.locator('[name="currency"]').selectOption("USD");
      await form.locator('[name="remarks"]').fill("AGENT TEST - Light cash-out after partial NN return.");
    });

    await submitOperation(page, "transfer", async (form) => {
      await form.locator('[name="fromCustomerId"]').selectOption("cust-00008");
      await form.locator('[name="toCustomerId"]').selectOption("cust-00009");
      await form.locator('[name="amount"]').fill("25");
      await form.locator('[name="currency"]').selectOption("USD");
      await form.locator('[name="remarks"]').fill("AGENT TEST - Light transfers support balance to Kai-A joint table.");
    });

    await submitOperation(page, "gameStart", async (form) => {
      await form.locator('[name="customerId"]').selectOption("cust-00009");
      await form.locator('[name="amount"]').fill("1000");
      await form.locator('[name="currency"]').selectOption("HKD");
      await form.locator('[name="mode"]').selectOption("ACCOUNT_BALANCE");
      await form.locator('[name="chipCategory"]').selectOption("DPNN13");
      await form.locator('[name="remarks"]').fill("AGENT TEST - Kai-A starts DPNN13 session for shared rolling target.");
    });

    await submitOperation(page, "creditSignout", async (form) => {
      await form.locator('[name="customerId"]').selectOption("cust-00009");
      await form.locator('[name="amount"]').fill("500");
      await form.locator('[name="currency"]').selectOption("HKD");
      await form.locator('[name="remarks"]').fill("AGENT TEST - Kai-A credit signed against Kai-B follow-up rolling.");
    });

    await submitOperation(page, "creditRepay", async (form) => {
      await form.locator('[name="customerId"]').selectOption("cust-00009");
      await form.locator('[name="amount"]').fill("100");
      await form.locator('[name="currency"]').selectOption("HKD");
      await form.locator('[name="remarks"]').fill("AGENT TEST - Kai-A repays part of joint credit after CC return.");
    });

    await submitOperation(page, "consumption", async (form) => {
      await form.locator('[name="customerId"]').selectOption("cust-00008");
      await form.locator('[name="amount"]').fill("20");
      await form.locator('[name="currency"]').selectOption("USD");
      await form.locator('[name="consumptionType"]').selectOption("cash");
      await form.locator('[name="subType"]').selectOption("room");
      await form.locator('[name="cashPaid"]').fill("5");
      await form.locator('[name="remarks"]').fill("AGENT TEST - Booking posts room charge for Light and Kai-A stay.");
    });

    expect(submissions.filter((entry) => entry.path !== "/login").map((entry) => entry.path)).toEqual([
      "/transactions/deposit",
      "/transactions/withdrawal",
      "/transactions/transfer",
      "/transactions/game-start",
      "/credit-records",
      "/credit-records",
      "/consumption-records"
    ]);
    expect(submissions.find((entry) => entry.path === "/transactions/deposit").body).toMatchObject({
      customerId: "cust-00008",
      amount: 300,
      paymentMethod: "現金",
      currency: "HKD"
    });
    expect(submissions.find((entry) => entry.path === "/transactions/withdrawal").body).toMatchObject({
      customerId: "cust-00008",
      amount: 50,
      withdrawalType: "取款",
      currency: "USD"
    });
    expect(submissions.find((entry) => entry.path === "/transactions/transfer").body).toMatchObject({
      fromCustomerId: "cust-00008",
      toCustomerId: "cust-00009",
      amount: 25,
      currency: "USD"
    });
    expect(submissions.find((entry) => entry.path === "/transactions/game-start").body).toMatchObject({
      kind: "NEW",
      customerId: "cust-00009",
      mode: "ACCOUNT_BALANCE",
      amount: 1000,
      chipCategory: "DPNN13",
      guestSegment: "YiDing Native",
      currency: "HKD"
    });
    expect(submissions.filter((entry) => entry.path === "/credit-records").map((entry) => entry.body.type)).toEqual(["borrow", "repay"]);
    expect(submissions.find((entry) => entry.path === "/consumption-records").body).toMatchObject({
      customerAccountId: "cust-00008",
      type: "cash",
      subType: "room",
      amount: 20,
      currency: "USD",
      cashPaid: 5
    });
  });

  test("handles settlement detail, session settlement, voids, consumption closeout and exports", async ({ page }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedAdminAuth(page);
    const submissions = await installPalaceMock(page);
    const openedUrls = [];

    await page.exposeFunction("captureOpenedUrl", (url) => {
      openedUrls.push(url);
    });
    await page.addInitScript(() => {
      window.open = (url) => {
        window.captureOpenedUrl(String(url));
        return null;
      };
      window.confirm = () => true;
      window.prompt = () => "AGENT TEST - supervisor approved reversal after booking/cage check.";
    });

    await openConnectedPalace(page);

    await page.locator('[data-chat-action="palace-settlement-view"][data-record-id="settle-1"]').click();
    await expect(page.locator("#dashboardChatBody")).toContainText("Settlement detail");
    await expect(page.locator("#dashboardChatBody")).toContainText("SESSION_SETTLEMENT");
    await expect(page.locator("#dashboardChatBody")).toContainText("AGENT TEST - Settlement detail links Light session to Kai-A shared rolling.");

    await page.locator('[data-chat-action="palace-session-quick-close"][data-session-id="session-live-00008"]').click();
    await expect(page.locator("#dashboardChatBody")).toContainText("Session closed through Palace settlement endpoint.");
    expect(submissions.find((entry) => entry.path === "/game-sessions/session-live-00008/settle").body).toEqual({
      remainingNn: 0,
      remainingCc: 0,
      settleCashOut: 0,
      settleToAccount: 0,
      tipNn: 0,
      tipCc: 0
    });

    await page.locator('[data-chat-action="palace-session-settle"][data-session-id="session-live-00008"]').click();
    await expect(page.locator("#palaceSessionSettlementForm")).toBeVisible();
    await page.locator('#palaceSessionSettlementForm [name="creditRepayAmount"]').fill("10");
    await page.locator('#palaceSessionSettlementForm [name="remainingNn"]').fill("1");
    await page.locator('#palaceSessionSettlementForm [name="remainingCc"]').fill("2");
    await page.locator('#palaceSessionSettlementForm [name="tipCc"]').fill("0.5");
    await page.locator('#palaceSessionSettlementForm [name="settleCashOut"]').fill("3");
    await page.locator('#palaceSessionSettlementForm [name="settleToAccount"]').fill("4");
    await page.locator('#palaceSessionSettlementForm [name="remarks"]').fill("AGENT TEST - detailed close after Light/Kai-A rolling review.");
    await page.locator("#palaceSessionSettlementForm").evaluate((form) => form.requestSubmit());
    await expect(page.locator("#dashboardChatBody")).toContainText("Detailed settlement submitted to Palace.");
    expect(submissions.filter((entry) => entry.path === "/game-sessions/session-live-00008/settle").at(-1).body).toMatchObject({
      remainingNn: 1,
      remainingCc: 2,
      settleCashOut: 3,
      settleToAccount: 4,
      tipNn: 0,
      tipCc: 0.5,
      tipTargetType: "STAFF",
      remarks: "AGENT TEST - detailed close after Light/Kai-A rolling review.",
      creditRepayAmount: 10
    });

    await page.locator('[data-chat-action="palace-credit-void"][data-record-id="credit-1"]').click();
    await expect(page.locator("#dashboardChatBody")).toContainText("Credit record voided.");
    expect(submissions.find((entry) => entry.path === "/credit-records/credit-1/void").body).toEqual({
      voidReason: "AGENT TEST - supervisor approved reversal after booking/cage check."
    });

    await page.locator('[data-chat-action="palace-consumption-settle"][data-record-id="consume-1"]').click();
    await expect(page.locator("#dashboardChatBody")).toContainText("Consumption record settled.");
    expect(submissions.find((entry) => entry.path === "/consumption-records/consume-1/settle").body).toEqual({});

    await page.locator('[data-chat-action="palace-consumption-void"][data-record-id="consume-1"]').click();
    await expect(page.locator("#dashboardChatBody")).toContainText("Consumption record voided.");
    expect(submissions.find((entry) => entry.path === "/consumption-records/consume-1/void").body).toEqual({
      voidReason: "AGENT TEST - supervisor approved reversal after booking/cage check."
    });

    await page.locator('[data-chat-action="palace-export-transactions"]').click();
    await page.locator('[data-chat-action="palace-export-settlements"]').click();
    await expect.poll(() => openedUrls.length).toBe(2);
    expect(openedUrls[0]).toContain("/api/palace/exports/transactions?period=daily&page=1");
    expect(openedUrls[1]).toContain("/api/palace/exports/settlement-records?period=daily");
  });
});
