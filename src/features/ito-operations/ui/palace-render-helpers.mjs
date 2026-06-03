const DEFAULT_CURRENCIES = Object.freeze(["HKD", "CNY", "USD", "VND"]);

export const PALACE_OPERATION_SUBMIT_LABELS = Object.freeze({
  deposit: "Submit deposit",
  withdraw: "Submit withdraw",
  transfer: "Submit transfer",
  gameStart: "Submit game start",
  creditSignout: "Submit credit sign-out",
  creditRepay: "Submit credit repay",
  consumption: "Submit consumption"
});

export function escapePalaceHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatPalaceAmount(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return escapePalaceHtml(String(value));
}

export function renderPalaceCurrencyOptions(currencies = DEFAULT_CURRENCIES, selectedCurrency = "") {
  return currencies
    .map((currency) => {
      const value = String(currency || "");
      return `<option value="${escapePalaceHtml(value)}"${selectedCurrency === value ? " selected" : ""}>${escapePalaceHtml(value)}</option>`;
    })
    .join("");
}

export function renderPalaceOperationButton(id, label, activeOperation) {
  const isActive = activeOperation === id;
  return `<button type="button" class="palace-native-tab${isActive ? " is-active" : ""}" data-palace-operation="${escapePalaceHtml(id)}">${escapePalaceHtml(label)}</button>`;
}

export function getPalaceOperationSubmitLabel(operation) {
  return PALACE_OPERATION_SUBMIT_LABELS[operation] || "Submit";
}

export function renderPalaceCustomerOptions(customers) {
  return (Array.isArray(customers) ? customers : [])
    .map((customer) => {
      const id = customer && customer.id;
      const accountNumber = customer && customer.accountNumber;
      const displayName = customer && customer.displayName;
      return `<option value="${escapePalaceHtml(id)}">${escapePalaceHtml(`${accountNumber || ""} · ${displayName || ""}`)}</option>`;
    })
    .join("");
}

export function renderPalaceSessionCustomerOptions(customers, selectedCustomerId = "") {
  const rows = (Array.isArray(customers) ? customers : []).map((customer) => {
    const id = String((customer && customer.id) || "");
    const accountNumber = customer && customer.accountNumber;
    const displayName = customer && customer.displayName;
    return `<option value="${escapePalaceHtml(id)}"${selectedCustomerId === id ? " selected" : ""}>${escapePalaceHtml(`${accountNumber || ""} · ${displayName || ""}`)}</option>`;
  });
  return ['<option value="">All active sessions</option>'].concat(rows).join("");
}

export function renderPalaceOperationFields({ operation, customerOptionsHtml, currencyOptionsHtml }) {
  const customerOptions = customerOptionsHtml || "";
  const currencyOptions = currencyOptionsHtml || renderPalaceCurrencyOptions();
  const fields = [];

  if (operation === "transfer") {
    fields.push(
      `<label class="dashboard-form-label">From<select class="dashboard-select" name="fromCustomerId" required><option value="">Select account</option>${customerOptions}</select></label>`,
      `<label class="dashboard-form-label">To<select class="dashboard-select" name="toCustomerId" required><option value="">Select account</option>${customerOptions}</select></label>`
    );
  } else {
    fields.push(`<label class="dashboard-form-label">Customer<select class="dashboard-select" name="customerId" required><option value="">Select account</option>${customerOptions}</select></label>`);
  }

  fields.push(
    '<div class="palace-native-grid">',
    '<label class="dashboard-form-label">Amount<input class="dashboard-input" name="amount" type="number" min="0" step="0.01" placeholder="0.00" required></label>',
    `<label class="dashboard-form-label">Currency<select class="dashboard-select" name="currency">${currencyOptions}</select></label>`,
    "</div>"
  );

  if (operation === "gameStart") {
    fields.push(
      '<div class="palace-native-grid">',
      '<label class="dashboard-form-label">Mode<select class="dashboard-select" name="mode"><option value="CASH">Cash</option><option value="ACCOUNT_BALANCE">Account balance</option></select></label>',
      '<label class="dashboard-form-label">Chip<select class="dashboard-select" name="chipCategory"><option value="DPNN11">DPNN11</option><option value="DPNN13">DPNN13</option></select></label>',
      "</div>"
    );
  }

  if (operation === "creditSignout" || operation === "creditRepay") {
    fields.push(`<input type="hidden" name="creditType" value="${operation === "creditRepay" ? "repay" : "borrow"}">`);
  }

  if (operation === "consumption") {
    fields.push(
      '<div class="palace-native-grid">',
      '<label class="dashboard-form-label">Type<select class="dashboard-select" name="consumptionType"><option value="cash">Cash</option><option value="deduct_points">Deduct points</option></select></label>',
      '<label class="dashboard-form-label">Category<select class="dashboard-select" name="subType"><option value="food">Food</option><option value="room">Room</option><option value="other">Other</option></select></label>',
      "</div>",
      '<div class="palace-native-grid">',
      '<label class="dashboard-form-label">Points<input class="dashboard-input" name="points" type="number" step="1" value="0"></label>',
      '<label class="dashboard-form-label">Cash paid<input class="dashboard-input" name="cashPaid" type="number" min="0" step="0.01" value="0"></label>',
      "</div>"
    );
  }

  return fields.join("");
}

export function renderPalaceRows(rows, columns) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const cells = (Array.isArray(columns) ? columns : []).map((column) => {
      const className = column && column.numeric ? ' class="palace-native-table__num"' : "";
      const rawValue = column && typeof column.value === "function"
        ? column.value(row)
        : row[column && column.key];
      return `<td${className}>${formatPalaceAmount(rawValue)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
}

export function renderPalaceCreditRows(rows, { pending = false } = {}) {
  return (Array.isArray(rows) ? rows : []).slice(0, 12).map((row) => {
    const actionCell = row && row.isVoid
      ? "Voided"
      : `<button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-credit-void" data-record-id="${escapePalaceHtml(row && row.id)}"${pending ? " disabled" : ""}>Void</button>`;
    return [
      "<tr>",
      `<td>${escapePalaceHtml((row && row.accountNumber) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.displayName) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.type) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.currency) || "")}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.amount)}</td>`,
      `<td>${escapePalaceHtml(((row && row.remark) || "—").slice(0, 120))}</td>`,
      `<td>${actionCell}</td>`,
      "</tr>"
    ].join("");
  }).join("");
}

export function renderPalaceConsumptionRows(rows, { pending = false } = {}) {
  return (Array.isArray(rows) ? rows : []).slice(0, 12).map((row) => {
    const actions = [];
    if (row && !row.isSettled && !row.isVoid) {
      actions.push(`<button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-consumption-settle" data-record-id="${escapePalaceHtml(row.id)}"${pending ? " disabled" : ""}>Settle</button>`);
    }
    if (row && !row.isVoid) {
      actions.push(`<button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-consumption-void" data-record-id="${escapePalaceHtml(row.id)}"${pending ? " disabled" : ""}>Void</button>`);
    }
    const actionCell = actions.join(" ") || (row && row.isVoid ? "Voided" : "Settled");
    return [
      "<tr>",
      `<td>${escapePalaceHtml((row && row.accountNumber) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.displayName) || "")}</td>`,
      `<td>${escapePalaceHtml(`${(row && row.type) || ""} / ${(row && row.subType) || ""}`)}</td>`,
      `<td>${escapePalaceHtml((row && row.currency) || "")}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.amount)}</td>`,
      `<td>${escapePalaceHtml(((row && row.remark) || "—").slice(0, 120))}</td>`,
      `<td>${actionCell}</td>`,
      "</tr>"
    ].join("");
  }).join("");
}

export function renderPalaceSessionRows(rows, { pending = false, formatDateTime = (value) => value } = {}) {
  return (Array.isArray(rows) ? rows : []).slice(0, 12).map((row) => {
    const sessionId = escapePalaceHtml(row && row.id);
    const openedAt = row && row.openedAt ? formatDateTime(row.openedAt) : "—";
    return [
      "<tr>",
      `<td>${escapePalaceHtml((row && row.accountNumber) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.displayName) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.openingMode) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.openingCurrency) || "")}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.openingAmount)}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.playableStack)}</td>`,
      `<td>${escapePalaceHtml(openedAt)}</td>`,
      `<td><div class="palace-native-row-actions"><button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-session-settle" data-session-id="${sessionId}"${pending ? " disabled" : ""}>Settle</button><button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-session-quick-close" data-session-id="${sessionId}"${pending ? " disabled" : ""}>Quick</button><button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-session-mid" data-session-id="${sessionId}">Mid</button><button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-session-tip" data-session-id="${sessionId}">Tip</button></div></td>`,
      "</tr>"
    ].join("");
  }).join("");
}

export function renderPalaceSettlementRows(rows, { detailLoading = false, formatDateTime = (value) => value } = {}) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const settledAt = row && row.settledAt ? formatDateTime(row.settledAt) : "—";
    return [
      "<tr>",
      `<td>${escapePalaceHtml(settledAt)}</td>`,
      `<td>${escapePalaceHtml((row && row.accountNumber) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.displayName) || "")}</td>`,
      `<td>${escapePalaceHtml((row && row.guestSegment) || "—")}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.principalAmount)}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.rollingAfter)}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.cashOut)}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.depositBack)}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.creditRepay)}</td>`,
      `<td class="palace-native-table__num">${formatPalaceAmount(row && row.winLoss)}</td>`,
      `<td>${escapePalaceHtml((row && row.chipCategory) || "")}</td>`,
      `<td><button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-settlement-view" data-record-id="${escapePalaceHtml(row && row.id)}"${detailLoading ? " disabled" : ""}>View</button></td>`,
      "</tr>"
    ].join("");
  }).join("");
}

export function renderPalaceSettlementFiltersForm(filters = {}, { loading = false } = {}) {
  const period = String(filters.period || "daily");
  const guest = escapePalaceHtml(filters.guest || "");
  const keyword = escapePalaceHtml(filters.keyword || "");
  const operator = escapePalaceHtml(filters.operator || "");
  const from = escapePalaceHtml(filters.from || "");
  const to = escapePalaceHtml(filters.to || "");
  return [
    '<form id="palaceSettlementFiltersForm" class="palace-native-form">',
    '<div class="palace-native-grid palace-native-grid--triple">',
    `<label class="dashboard-form-label">Period<select class="dashboard-select" name="period"><option value="daily"${period === "daily" ? " selected" : ""}>Daily</option><option value="weekly"${period === "weekly" ? " selected" : ""}>Weekly</option><option value="monthly"${period === "monthly" ? " selected" : ""}>Monthly</option></select></label>`,
    `<label class="dashboard-form-label">Guest segment<input class="dashboard-input" name="guest" value="${guest}" placeholder="VIP / AGENT TEST"></label>`,
    `<label class="dashboard-form-label">Keyword<input class="dashboard-input" name="keyword" value="${keyword}" placeholder="Account or note"></label>`,
    "</div>",
    '<div class="palace-native-grid palace-native-grid--triple">',
    `<label class="dashboard-form-label">Operator<input class="dashboard-input" name="operator" value="${operator}" placeholder="Operator"></label>`,
    `<label class="dashboard-form-label">From<input class="dashboard-input" name="from" type="datetime-local" value="${from}"></label>`,
    `<label class="dashboard-form-label">To<input class="dashboard-input" name="to" type="datetime-local" value="${to}"></label>`,
    "</div>",
    `<div class="palace-native-actions"><button type="submit" class="dashboard-button dashboard-button--accent"${loading ? " disabled" : ""}>Load settlements</button><button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-settlement-reset"${loading ? " disabled" : ""}>Reset</button></div>`,
    "</form>"
  ].join("");
}

export function renderPalaceSettlementPager({ page = 1, totalPages = 1, total = 0, loading = false } = {}) {
  const currentPage = Math.max(1, Number(page || 1));
  const pageCount = Math.max(1, Number(totalPages || 1));
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(pageCount, currentPage + 1);
  return [
    '<div class="palace-native-actions palace-native-actions--between">',
    `<span class="palace-native-copy">Page ${escapePalaceHtml(String(currentPage))} / ${escapePalaceHtml(String(pageCount))} · total ${escapePalaceHtml(String(total || 0))}</span>`,
    '<div class="palace-native-actions">',
    `<button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-settlement-page" data-page="${escapePalaceHtml(String(previousPage))}"${currentPage <= 1 || loading ? " disabled" : ""}>Prev</button>`,
    `<button type="button" class="dashboard-button dashboard-button--ghost" data-chat-action="palace-settlement-page" data-page="${escapePalaceHtml(String(nextPage))}"${currentPage >= pageCount || loading ? " disabled" : ""}>Next</button>`,
    "</div>",
    "</div>"
  ].join("");
}
