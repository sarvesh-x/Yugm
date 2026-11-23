/**
 * Read-only query-profile audit for DCR-2 input preparation.
 *
 * Validates caller-supplied query observations against documented D1 hard
 * limits and reports index/full-scan/headroom evidence for owner review.
 * It never reads MongoDB, D1, Cloudflare or any remote service.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { D1_HARD_LIMITS } from "./d1CapacityGate.js";
import { ValidationReportBuilder } from "./validate.js";

export interface QueryObservation {
  id: string;
  pattern: string;
  frequencyPerMinute: number;
  rowsScanned: number;
  rowsReturned?: number;
  durationMs: number;
  resultBytes: number;
  statementBytes: number;
  boundParameters: number;
  usesIndex: boolean;
  fullCollectionScan: boolean;
}

export interface QueryProfileReport {
  source: string;
  recordCount: number;
  totalFrequencyPerMinute: number;
  demandQps: number;
  weightedAverageDurationMs: number | null;
  estimatedCapacityQps: number | null;
  percentiles: { p50Ms: number | null; p95Ms: number | null; p99Ms: number | null };
  maxRowsScanned: number;
  maxDurationMs: number;
  maxResultBytes: number;
  maxStatementBytes: number;
  maxBoundParameters: number;
  fullScanCount: number;
  unindexedCount: number;
  hardGatesPassed: boolean;
  checks: Array<{ domain: string; name: string; passed: boolean; detail?: string }>;
  reviewItems: Array<{ id: string; statement: string; measurement: string }>;
  digest: string;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a non-empty string`);
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, optional = false): number | undefined {
  const value = record[key];
  if (value === undefined && optional) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be a finite, non-negative number`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}

export function parseQueryObservation(value: unknown): QueryObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("query observation must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  return {
    id: readString(record, "id"),
    pattern: readString(record, "pattern"),
    frequencyPerMinute: readNumber(record, "frequencyPerMinute")!,
    rowsScanned: readNumber(record, "rowsScanned")!,
    rowsReturned: readNumber(record, "rowsReturned", true),
    durationMs: readNumber(record, "durationMs")!,
    resultBytes: readNumber(record, "resultBytes")!,
    statementBytes: readNumber(record, "statementBytes")!,
    boundParameters: readNumber(record, "boundParameters")!,
    usesIndex: readBoolean(record, "usesIndex"),
    fullCollectionScan: readBoolean(record, "fullCollectionScan"),
  };
}

function percentile(sorted: readonly number[], fraction: number): number | null {
  if (!sorted.length) return null;
  const position = Math.max(1, Math.ceil(sorted.length * fraction));
  return sorted[position - 1];
}

export function buildQueryProfile(records: readonly QueryObservation[], source: string): QueryProfileReport {
  const builder = new ValidationReportBuilder();
  const durations = records.map((record) => record.durationMs).sort((a, b) => a - b);
  const totalFrequencyPerMinute = records.reduce((sum, record) => sum + record.frequencyPerMinute, 0);
  const demandQps = totalFrequencyPerMinute / 60;
  const weightedDuration = totalFrequencyPerMinute > 0
    ? records.reduce((sum, record) => sum + record.durationMs * record.frequencyPerMinute, 0) / totalFrequencyPerMinute
    : null;
  const estimatedCapacityQps = weightedDuration !== null && weightedDuration > 0 ? 1_000 / weightedDuration : null;

  const maxRowsScanned = records.reduce((max, record) => Math.max(max, record.rowsScanned), 0);
  const maxDurationMs = records.reduce((max, record) => Math.max(max, record.durationMs), 0);
  const maxResultBytes = records.reduce((max, record) => Math.max(max, record.resultBytes), 0);
  const maxStatementBytes = records.reduce((max, record) => Math.max(max, record.statementBytes), 0);
  const maxBoundParameters = records.reduce((max, record) => Math.max(max, record.boundParameters), 0);
  const fullScanCount = records.filter((record) => record.fullCollectionScan).length;
  const unindexedCount = records.filter((record) => !record.usesIndex).length;

  builder.assert(
    "query",
    "statement-size",
    maxStatementBytes <= D1_HARD_LIMITS.statementBytes,
    `largest statement ${maxStatementBytes}, limit ${D1_HARD_LIMITS.statementBytes}`
  );
  builder.assert(
    "query",
    "bound-parameters",
    maxBoundParameters <= D1_HARD_LIMITS.boundParameters,
    `max bound parameters ${maxBoundParameters}, limit ${D1_HARD_LIMITS.boundParameters}`
  );
  builder.assert(
    "query",
    "result-size",
    maxResultBytes <= D1_HARD_LIMITS.queryResultBytes,
    `largest result ${maxResultBytes}, limit ${D1_HARD_LIMITS.queryResultBytes}`
  );
  builder.assert(
    "query",
    "statement-duration",
    maxDurationMs <= D1_HARD_LIMITS.queryDurationMs,
    `slowest statement ${maxDurationMs} ms, limit ${D1_HARD_LIMITS.queryDurationMs} ms`
  );

  const report = builder.report(source);
  const hash = createHash("sha256");
  hash.update(`${source}|${report.passed}|${totalFrequencyPerMinute}|${maxRowsScanned}|${maxDurationMs}\n`);
  for (const record of [...records].sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(`${record.id}|${record.durationMs}|${record.rowsScanned}|${record.fullCollectionScan}\n`);
  }

  return {
    source,
    recordCount: records.length,
    totalFrequencyPerMinute,
    demandQps: Number(demandQps.toFixed(3)),
    weightedAverageDurationMs: weightedDuration === null ? null : Number(weightedDuration.toFixed(3)),
    estimatedCapacityQps: estimatedCapacityQps === null ? null : Number(estimatedCapacityQps.toFixed(3)),
    percentiles: {
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      p99Ms: percentile(durations, 0.99),
    },
    maxRowsScanned,
    maxDurationMs,
    maxResultBytes,
    maxStatementBytes,
    maxBoundParameters,
    fullScanCount,
    unindexedCount,
    hardGatesPassed: report.passed,
    checks: report.checks,
    reviewItems: [
      {
        id: "indexed-query-shape",
        statement: "Full collection scans and unindexed queries must be justified or eliminated before D1 cutover.",
        measurement: `${fullScanCount} full scan(s), ${unindexedCount} unindexed observation(s) of ${records.length}`,
      },
      {
        id: "rows-scanned-billing",
        statement: "Rows scanned drive D1 read billing; confirm the observed pattern against the projected monthly budget.",
        measurement: `max rows scanned ${maxRowsScanned}; total frequency ${totalFrequencyPerMinute}/min`,
      },
      {
        id: "throughput-headroom",
        statement: "Peak demand must fit single-database throughput with substantial headroom; this estimate is coarse.",
        measurement: estimatedCapacityQps === null
          ? "no frequency-weighted observations"
          : `demand ${demandQps.toFixed(3)} QPS vs estimated ${estimatedCapacityQps.toFixed(3)} QPS`,
      },
      {
        id: "query-duration-comfort",
        statement: "Hard-limit PASS does not prove queries stay far below the 30-second statement limit.",
        measurement: `p99 ${percentile(durations, 0.99) ?? "n/a"} ms; slowest ${maxDurationMs} ms`,
      },
    ],
    digest: hash.digest("hex"),
  };
}

export async function readQueryProfileInput(file: string): Promise<{ source: string; records: QueryObservation[] }> {
  const resolved = path.resolve(file);
  const content = await readFile(resolved, "utf8");
  const records: QueryObservation[] = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      records.push(parseQueryObservation(JSON.parse(line) as unknown));
    } catch (error) {
      throw new Error(`${path.basename(resolved)} line ${index + 1}: ${error instanceof Error ? error.message : "invalid JSON"}`);
    }
  }
  return { source: path.basename(resolved), records };
}
