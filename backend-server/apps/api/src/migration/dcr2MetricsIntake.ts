/**
 * Intake helper for owner-supplied DCR-2 metrics.
 *
 * It reports which fields are still missing or invalid before running the
 * hard-limit screener. It never reads MongoDB, D1, Cloudflare or any remote
 * service, and it never infers values from source presence.
 */
import { evaluateD1CapacityGates, type D1CapacityMetrics } from "./d1CapacityGate.js";

export const DCR2_FIELD_GUIDANCE: Record<keyof D1CapacityMetrics, string> = {
  snapshotId: "Identifier for the metrics collection run",
  sourceEnvironment: "Environment label only; no connection strings or credentials",
  collectedAt: "UTC ISO timestamp when metrics were collected",
  workersPaid: "Whether Workers Paid is approved and configured",
  relationalBytes: "Total relational data bytes after binaries move to R2",
  indexBytes: "Total D1 index bytes",
  projected12MonthTotalBytes: "Final projected relational+index total at 12 months",
  largestRowBytes: "Largest single row after normalization and R2 extraction",
  binariesInD1Bytes: "Binary bytes still present in D1; must be zero at cutover",
  largestStatementBytes: "Largest observed SQL statement size in bytes",
  maxBoundParameters: "Largest observed bound-parameter count",
  largestQueryResultBytes: "Largest observed query result size in bytes",
  p99QueryDurationMs: "p99 indexed query duration in milliseconds",
  averageWriteDurationMs: "Average write duration in milliseconds for throughput estimate",
  peakWritesPerSecond: "Observed peak write rate in operations per second",
  peakQueriesPerInvocation: "Observed peak query count in a single Worker invocation",
};

export const DCR2_METRIC_FIELDS = Object.keys(DCR2_FIELD_GUIDANCE) as Array<keyof D1CapacityMetrics>;

export type Dcr2MetricsTemplate = Record<keyof D1CapacityMetrics, null>;

export function emptyDcr2MetricsTemplate(): Dcr2MetricsTemplate {
  return DCR2_METRIC_FIELDS.reduce((template, field) => {
    template[field] = null;
    return template;
  }, {} as Dcr2MetricsTemplate);
}

export interface MetricsIntakeReport {
  ready: boolean;
  missing: string[];
  invalid: string[];
  extra: string[];
  guidance: Record<string, string>;
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isValid(field: keyof D1CapacityMetrics, value: unknown): boolean {
  if (field === "workersPaid") return typeof value === "boolean";
  if (field === "snapshotId" || field === "sourceEnvironment" || field === "collectedAt") {
    return typeof value === "string" && value.trim().length > 0;
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function assessDcr2Metrics(value: unknown): MetricsIntakeReport {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const field of DCR2_METRIC_FIELDS) {
    const candidate = record[field];
    if (!isPresent(candidate)) missing.push(field);
    else if (!isValid(field, candidate)) invalid.push(field);
  }

  const extra = Object.keys(record)
    .filter((key) => !DCR2_METRIC_FIELDS.includes(key as keyof D1CapacityMetrics))
    .sort();

  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    extra,
    guidance: { ...DCR2_FIELD_GUIDANCE },
  };
}

export function screenReadyMetrics(value: unknown) {
  const intake = assessDcr2Metrics(value);
  if (!intake.ready) return { intake, report: null };
  return {
    intake,
    report: evaluateD1CapacityGates(value as unknown as D1CapacityMetrics),
  };
}
