import { LedgerDirection } from "./ito-constants.mjs";

const REQUIRED_ENTRY_FIELDS = Object.freeze([
  "accountId",
  "ledgerId",
  "asset",
  "currency",
  "direction",
  "amount",
  "sourceType",
  "sourceId"
]);

export function normalizeLedgerAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Ledger amount must be a zero or positive number.");
  }
  return Math.round(amount * 100) / 100;
}

export function createLedgerEntry(input) {
  const entry = {
    accountId: String(input.accountId || ""),
    cageId: String(input.cageId || ""),
    ledgerId: String(input.ledgerId || ""),
    asset: String(input.asset || ""),
    currency: String(input.currency || ""),
    direction: String(input.direction || ""),
    amount: normalizeLedgerAmount(input.amount),
    sourceType: String(input.sourceType || ""),
    sourceId: String(input.sourceId || ""),
    memo: String(input.memo || ""),
    createdAt: input.createdAt || new Date().toISOString()
  };

  for (const field of REQUIRED_ENTRY_FIELDS) {
    if (!entry[field] && field !== "amount") {
      throw new Error(`Ledger entry missing ${field}.`);
    }
  }

  if (!Object.values(LedgerDirection).includes(entry.direction)) {
    throw new Error("Ledger direction must be DEBIT or CREDIT.");
  }

  return Object.freeze(entry);
}

export function groupLedgerEntries(entries) {
  const groups = new Map();
  for (const entry of entries || []) {
    const key = [entry.ledgerId, entry.asset, entry.currency].join("|");
    const current = groups.get(key) || {
      ledgerId: entry.ledgerId,
      asset: entry.asset,
      currency: entry.currency,
      debit: 0,
      credit: 0,
      entries: []
    };
    if (entry.direction === LedgerDirection.DEBIT) {
      current.debit += Number(entry.amount || 0);
    } else if (entry.direction === LedgerDirection.CREDIT) {
      current.credit += Number(entry.amount || 0);
    }
    current.entries.push(entry);
    groups.set(key, current);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    debit: normalizeLedgerAmount(group.debit),
    credit: normalizeLedgerAmount(group.credit),
    difference: normalizeLedgerAmount(Math.abs(group.debit - group.credit))
  }));
}

export function validateBalancedLedger(entries) {
  const groups = groupLedgerEntries(entries);
  const imbalanced = groups.filter((group) => group.difference > 0.000001);
  return {
    valid: imbalanced.length === 0,
    groups,
    imbalanced
  };
}

export function requireBalancedLedger(entries) {
  const result = validateBalancedLedger(entries);
  if (!result.valid) {
    const first = result.imbalanced[0];
    throw new Error(`Ledger group ${first.ledgerId}/${first.asset}/${first.currency} is not balanced.`);
  }
  return result;
}

