/**
 * Read-only sizing of authoritative financial collections between snapshots.
 *
 * Filters the existing snapshot diff to money-related collections so the owner
 * can judge whether financial deltas need a maintenance window. It does not
 * reconcile balances, read MongoDB/D1 or implement any delta import.
 */
import { createHash } from "node:crypto";
import { diffSnapshots, type CollectionDiff } from "./snapshotDiff.js";

export const FINANCIAL_COLLECTIONS = [
  "wallet_transactions",
  "diamond_transactions",
  "purchases",
  "gift_transactions",
  "withdrawal_requests",
  "subscriptions",
] as const;

export interface FinancialDeltaReport {
  before: string;
  after: string;
  collections: readonly string[];
  summary: { added: number; removed: number; changed: number; unchanged: number };
  byCollection: CollectionDiff[];
  reviewItems: Array<{ id: string; statement: string }>;
  digest: string;
}

export async function auditFinancialDelta(
  beforeDirectory: string,
  afterDirectory: string
): Promise<FinancialDeltaReport> {
  const diff = await diffSnapshots(beforeDirectory, afterDirectory);
  const wanted = new Set<string>(FINANCIAL_COLLECTIONS);
  const byCollection = diff.collections
    .filter((entry) => wanted.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary = {
    added: byCollection.reduce((sum, entry) => sum + entry.added, 0),
    removed: byCollection.reduce((sum, entry) => sum + entry.removed, 0),
    changed: byCollection.reduce((sum, entry) => sum + entry.changed, 0),
    unchanged: byCollection.reduce((sum, entry) => sum + entry.unchanged, 0),
  };

  const reviewItems = [
    {
      id: "ledger-reconciliation",
      statement: "Changed wallet/ledger rows must reconcile against balances in an isolated restored copy.",
    },
    {
      id: "maintenance-window",
      statement: "Peak financial write rate and downtime tolerance decide whether deltas run online or under maintenance.",
    },
    {
      id: "idempotency-replay",
      statement: "Replaying a financial delta must not double-credit or double-debit; idempotency keys must be preserved.",
    },
  ];

  const hash = createHash("sha256");
  hash.update(`${diff.before.snapshotId}|${diff.after.snapshotId}\n`);
  for (const entry of byCollection) {
    hash.update(`${entry.name}|${entry.added}|${entry.removed}|${entry.changed}|${entry.unchanged}\n`);
  }

  return {
    before: diff.before.snapshotId,
    after: diff.after.snapshotId,
    collections: FINANCIAL_COLLECTIONS,
    summary,
    byCollection,
    reviewItems,
    digest: hash.digest("hex"),
  };
}
