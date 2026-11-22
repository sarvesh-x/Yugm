/** Restartable import progress helpers. No storage backend is assumed. */
import type { Checkpoint } from "./types.js";

export function batchId(snapshotId: string, phase: string, collection: string, lastSourceId: string): string {
  return `${snapshotId}:${phase}:${collection}:${lastSourceId || "start"}`;
}

export function newCheckpoint(snapshotId: string, phase: string, collection: string): Checkpoint {
  return {
    snapshotId,
    phase,
    collection,
    status: "pending",
    processed: 0,
    completedBatches: [],
    checksum: "",
    updatedAt: new Date().toISOString()
  };
}

/** Returns false when the batch was already applied, so replay cannot duplicate rows. */
export function shouldApplyBatch(checkpoint: Checkpoint | undefined, id: string): boolean {
  return !checkpoint?.completedBatches.includes(id);
}

export function advanceCheckpoint(
  checkpoint: Checkpoint,
  id: string,
  processedDelta: number,
  lastSourceId: string,
  checksum: string
): Checkpoint {
  if (!shouldApplyBatch(checkpoint, id)) return checkpoint;
  return {
    ...checkpoint,
    status: "in_progress",
    processed: checkpoint.processed + processedDelta,
    lastSourceId,
    completedBatches: [...checkpoint.completedBatches, id],
    checksum,
    updatedAt: new Date().toISOString()
  };
}

export function completeCheckpoint(checkpoint: Checkpoint, checksum: string): Checkpoint {
  return { ...checkpoint, status: "complete", checksum, updatedAt: new Date().toISOString() };
}
