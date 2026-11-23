/**
 * Cross-checks a declared 12-month D1 projection against observed snapshot growth.
 *
 * Reads only local snapshot manifests and a caller-supplied metrics file. It
 * never reads MongoDB, D1, R2 or any remote service. A result is evidence for
 * review, not an acceptance decision: retention, seasonality and index growth
 * still require owner judgment.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseD1CapacityMetrics } from "./d1CapacityGate.js";
import { readSnapshotManifest } from "./snapshot.js";

export interface ProjectionAuditReport {
  before: string;
  after: string;
  windowHours: number | null;
  beforeBytes: number;
  afterBytes: number;
  observedGrowthBytes: number;
  growthBytesPerHour: number | null;
  currentTotalBytes: number;
  declaredProjectionBytes: number;
  projectedFromGrowthBytes: number | null;
  declaredAtLeastObserved: boolean | null;
  declaredToObservedRatio: number | null;
  metricsMinusSnapshotBytes: number;
  reviewItems: Array<{ id: string; statement: string }>;
  digest: string;
}

function manifestBytes(manifest: { collections: Array<{ batches: Array<{ bytes: number }> }> }): number {
  return manifest.collections.reduce(
    (total, collection) => total + collection.batches.reduce((sum, batch) => sum + batch.bytes, 0),
    0
  );
}

export async function auditProjection(
  beforeDirectory: string,
  afterDirectory: string,
  metricsFile: string
): Promise<ProjectionAuditReport> {
  const [before, after, rawMetrics] = await Promise.all([
    readSnapshotManifest(path.resolve(beforeDirectory)),
    readSnapshotManifest(path.resolve(afterDirectory)),
    readFile(path.resolve(metricsFile), "utf8").then((text) => JSON.parse(text) as unknown),
  ]);
  const metrics = parseD1CapacityMetrics(rawMetrics);

  const start = Date.parse(before.watermark);
  const end = Date.parse(after.watermark);
  const windowHours = Number.isFinite(start) && Number.isFinite(end) && end > start
    ? (end - start) / 3_600_000
    : null;
  const beforeBytes = manifestBytes(before);
  const afterBytes = manifestBytes(after);
  const observedGrowthBytes = afterBytes - beforeBytes;
  const growthBytesPerHour = windowHours === null ? null : observedGrowthBytes / windowHours;
  const currentTotalBytes = metrics.relationalBytes + metrics.indexBytes;
  const projectedFromGrowthBytes = growthBytesPerHour === null
    ? null
    : currentTotalBytes + growthBytesPerHour * 24 * 365;
  const declaredAtLeastObserved = projectedFromGrowthBytes === null
    ? null
    : metrics.projected12MonthTotalBytes >= projectedFromGrowthBytes;
  const declaredToObservedRatio = projectedFromGrowthBytes === null || projectedFromGrowthBytes === 0
    ? null
    : Number((metrics.projected12MonthTotalBytes / projectedFromGrowthBytes).toFixed(3));

  const hash = createHash("sha256");
  hash.update(`${before.snapshotId}|${after.snapshotId}|${metrics.snapshotId}\n`);
  hash.update(`${windowHours ?? "invalid"}|${beforeBytes}|${afterBytes}|${currentTotalBytes}|${metrics.projected12MonthTotalBytes}\n`);
  if (projectedFromGrowthBytes !== null) hash.update(`${projectedFromGrowthBytes}\n`);

  return {
    before: before.snapshotId,
    after: after.snapshotId,
    windowHours,
    beforeBytes,
    afterBytes,
    observedGrowthBytes,
    growthBytesPerHour,
    currentTotalBytes,
    declaredProjectionBytes: metrics.projected12MonthTotalBytes,
    projectedFromGrowthBytes,
    declaredAtLeastObserved,
    declaredToObservedRatio,
    metricsMinusSnapshotBytes: currentTotalBytes - afterBytes,
    reviewItems: [
      {
        id: "retention-policy",
        statement: "Observed growth may include temporary or retained data; confirm deletion/retention policy before accepting the projection.",
      },
      {
        id: "seasonality",
        statement: "A short snapshot window cannot establish seasonal peaks or step changes; use monitoring evidence for those.",
      },
      {
        id: "index-growth",
        statement: "Snapshot bytes cover exported records; index bytes must be measured and included separately in the metrics file.",
      },
      {
        id: "baseline-alignment",
        statement: "Metrics relational+index bytes should align with the later snapshot's declared batch bytes; investigate large differences.",
      },
    ],
    digest: hash.digest("hex"),
  };
}
