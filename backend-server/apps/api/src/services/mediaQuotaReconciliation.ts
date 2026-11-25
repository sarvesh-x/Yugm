import { createHash } from "node:crypto";

export type QuotaReconciliationStatus = "OK" | "OVER_RESERVED" | "UNDER_RESERVED" | "MISSING_COUNTER";

export interface QuotaReconciliationRow {
  userId: string;
  counterBytes: number;
  expectedBytes: number;
  deltaBytes: number;
  status: QuotaReconciliationStatus;
}

export interface QuotaReconciliationReport {
  generatedAt: string;
  counterCount: number;
  driftCount: number;
  staleSessions: number;
  rows: QuotaReconciliationRow[];
  digest: string;
}

export function buildQuotaReconciliation(
  counters: ReadonlyArray<{ userId: string; bytes: number }>,
  expected: ReadonlyArray<{ userId: string; bytes: number }>,
  staleSessions: number,
  generatedAt = new Date().toISOString()
): QuotaReconciliationReport {
  const counterMap = new Map(counters.map((row) => [row.userId, row.bytes]));
  const expectedMap = new Map(expected.map((row) => [row.userId, row.bytes]));
  const userIds = [...new Set([...counterMap.keys(), ...expectedMap.keys()])].sort();

  const rows: QuotaReconciliationRow[] = userIds.map((userId) => {
    const counterBytes = counterMap.get(userId) ?? 0;
    const expectedBytes = expectedMap.get(userId) ?? 0;
    const deltaBytes = counterBytes - expectedBytes;
    const status: QuotaReconciliationStatus = !counterMap.has(userId)
      ? "MISSING_COUNTER"
      : deltaBytes > 0
        ? "OVER_RESERVED"
        : deltaBytes < 0
          ? "UNDER_RESERVED"
          : "OK";
    return { userId, counterBytes, expectedBytes, deltaBytes, status };
  }).sort((a, b) => Math.abs(b.deltaBytes) - Math.abs(a.deltaBytes) || a.userId.localeCompare(b.userId));

  const digestInput = rows.map((row) => `${row.userId}:${row.counterBytes}:${row.expectedBytes}:${row.status}`).join("\n");
  return {
    generatedAt,
    counterCount: counterMap.size,
    driftCount: rows.filter((row) => row.status !== "OK").length,
    staleSessions,
    rows,
    digest: createHash("sha256").update(`${staleSessions}\n${digestInput}\n`).digest("hex"),
  };
}
