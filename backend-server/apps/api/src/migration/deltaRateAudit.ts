/**
 * Read-only average change-rate audit between two copied snapshots.
 *
 * Uses manifest watermarks and the existing snapshot diff to estimate average
 * changes per hour. It never reads MongoDB/D1, does not observe peak load, and
 * does not decide online vs maintenance-window delta import.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { readSnapshotManifest } from "./snapshot.js";
import { diffSnapshots } from "./snapshotDiff.js";

export interface CollectionRate {
  name: string;
  added: number;
  removed: number;
  changed: number;
  addedPerHour: number | null;
  removedPerHour: number | null;
  changedPerHour: number | null;
}

export interface DeltaRateReport {
  before: string;
  after: string;
  beforeWatermark: string;
  afterWatermark: string;
  hours: number | null;
  totalAdded: number;
  totalRemoved: number;
  totalChanged: number;
  totalPerHour: number | null;
  collections: CollectionRate[];
  reviewItems: Array<{ id: string; statement: string }>;
  digest: string;
}

function rate(count: number, hours: number | null): number | null {
  return hours === null || hours <= 0 ? null : Number((count / hours).toFixed(3));
}

export async function auditDeltaRates(
  beforeDirectory: string,
  afterDirectory: string
): Promise<DeltaRateReport> {
  const [beforeManifest, afterManifest] = await Promise.all([
    readSnapshotManifest(path.resolve(beforeDirectory)),
    readSnapshotManifest(path.resolve(afterDirectory)),
  ]);
  const diff = await diffSnapshots(beforeDirectory, afterDirectory);

  const start = Date.parse(beforeManifest.watermark);
  const end = Date.parse(afterManifest.watermark);
  const hours = Number.isFinite(start) && Number.isFinite(end) && end > start
    ? (end - start) / 3_600_000
    : null;

  const collections: CollectionRate[] = diff.collections
    .map((entry) => ({
      name: entry.name,
      added: entry.added,
      removed: entry.removed,
      changed: entry.changed,
      addedPerHour: rate(entry.added, hours),
      removedPerHour: rate(entry.removed, hours),
      changedPerHour: rate(entry.changed, hours),
    }))
    .sort((a, b) => b.changed + b.added - (a.changed + a.added) || a.name.localeCompare(b.name));

  const totalAdded = collections.reduce((sum, entry) => sum + entry.added, 0);
  const totalRemoved = collections.reduce((sum, entry) => sum + entry.removed, 0);
  const totalChanged = collections.reduce((sum, entry) => sum + entry.changed, 0);

  const hash = createHash("sha256");
  hash.update(`${beforeManifest.snapshotId}|${afterManifest.snapshotId}|${hours ?? "invalid"}\n`);
  for (const entry of collections) {
    hash.update(`${entry.name}|${entry.added}|${entry.removed}|${entry.changed}\n`);
  }

  return {
    before: beforeManifest.snapshotId,
    after: afterManifest.snapshotId,
    beforeWatermark: beforeManifest.watermark,
    afterWatermark: afterManifest.watermark,
    hours,
    totalAdded,
    totalRemoved,
    totalChanged,
    totalPerHour: rate(totalAdded + totalRemoved + totalChanged, hours),
    collections,
    reviewItems: [
      {
        id: "average-is-not-peak",
        statement: "A two-snapshot average cannot establish peak write rate; monitoring or operational metrics are still required.",
      },
      {
        id: "online-vs-window",
        statement: "Owner decides online delta replay vs a maintenance window from peak rate and cutover downtime tolerance.",
      },
      {
        id: "financial-peak",
        statement: "Financial deltas may need a separate peak-rate check before the final window is approved.",
      },
    ],
    digest: hash.digest("hex"),
  };
}
