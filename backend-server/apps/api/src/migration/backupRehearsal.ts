/**
 * Single-command local backup rehearsal.
 *
 * Chains snapshot-copy verification with the existing dry-run importer so one
 * report covers both integrity mapping and mapping/validation behavior. It
 * reads only the supplied copied snapshot directory and writes only the report
 * artifacts directory. It never connects to MongoDB, D1, R2 or any remote
 * service, and it is not a restore test.
 */
import path from "node:path";
import { rehearseSnapshot, type RehearsalResult } from "./rehearsal.js";
import { verifyBackup, type BackupVerificationResult } from "./verifyBackup.js";

export interface BackupRehearsalResult {
  snapshotId: string;
  verification: BackupVerificationResult;
  rehearsal: RehearsalResult | null;
  /** Both hard checks must pass. Still not proof of a production restore. */
  passed: boolean;
}

export async function rehearseBackup(
  snapshotDirectory: string,
  outputDirectory: string,
  expectedDigest?: string
): Promise<BackupRehearsalResult> {
  const verification = await verifyBackup(path.resolve(snapshotDirectory), expectedDigest);
  if (!verification.passed) {
    return { snapshotId: verification.snapshotId, verification, rehearsal: null, passed: false };
  }

  const rehearsal = await rehearseSnapshot({
    snapshotDirectory: path.resolve(snapshotDirectory),
    outputDirectory: path.resolve(outputDirectory),
  });
  return {
    snapshotId: rehearsal.snapshotId,
    verification,
    rehearsal,
    passed: rehearsal.validation.passed,
  };
}
