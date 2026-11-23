/**
 * Read-only DCR-2 recovery-evidence checker.
 *
 * Validates existing backup verification output, dry-run rehearsal artifacts
 * and an owner attestation. It never runs a restore, connects to a database or
 * service, or claims that recovery has been proven.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const RECOVERY_ATTESTATION_BOOLEANS = [
  "restoredInIsolatedEnvironment",
  "financialReconciliationPassed",
  "mediaReferenceResolutionPassed",
  "rpoRtoMeasured",
  "accessControlsConfirmed",
] as const;

export interface RecoveryEvidenceReport {
  snapshotId: string | null;
  verificationPassed: boolean;
  rehearsalPassed: boolean;
  transformReportPresent: boolean;
  idMapLines: number;
  attestationComplete: boolean;
  missingAttestationFields: string[];
  snapshotIdMismatch: boolean;
  evidenceComplete: boolean;
  reviewItems: Array<{ id: string; statement: string }>;
  digest: string;
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.resolve(file), "utf8")) as Record<string, unknown>;
}

export async function assessRecoveryEvidence(options: {
  verificationFile: string;
  rehearsalDirectory: string;
  attestationFile: string;
}): Promise<RecoveryEvidenceReport> {
  const verification = await readJson(options.verificationFile);
  const rehearsal = await readJson(path.join(options.rehearsalDirectory, "validation-report.json"));
  const attestation = await readJson(options.attestationFile);

  let transformReportPresent = true;
  try {
    await readFile(path.join(options.rehearsalDirectory, "transform-report.json"), "utf8");
  } catch {
    transformReportPresent = false;
  }

  let idMapLines = 0;
  try {
    const idMap = await readFile(path.join(options.rehearsalDirectory, "id-map.jsonl"), "utf8");
    idMapLines = idMap.split("\n").filter((line) => line.trim()).length;
  } catch {
    idMapLines = 0;
  }

  const missingAttestationFields: string[] = [];
  for (const field of RECOVERY_ATTESTATION_BOOLEANS) {
    if (attestation[field] !== true) missingAttestationFields.push(field);
  }
  for (const field of ["owner", "date", "snapshotId"] as const) {
    const value = attestation[field];
    if (typeof value !== "string" || !value.trim()) missingAttestationFields.push(field);
  }
  const attestationComplete = missingAttestationFields.length === 0;

  const verificationSnapshot = typeof verification.snapshotId === "string" ? verification.snapshotId : null;
  const rehearsalSnapshot = typeof rehearsal.snapshotId === "string" ? rehearsal.snapshotId : null;
  const attestationSnapshot = typeof attestation.snapshotId === "string" ? attestation.snapshotId : null;
  const identifiers = [verificationSnapshot, rehearsalSnapshot, attestationSnapshot].filter(
    (value): value is string => value !== null
  );
  const snapshotIdMismatch = identifiers.length > 0 && new Set(identifiers).size > 1;

  const verificationPassed = verification.passed === true;
  const rehearsalPassed = rehearsal.passed === true;
  const evidenceComplete =
    verificationPassed &&
    rehearsalPassed &&
    transformReportPresent &&
    idMapLines > 0 &&
    attestationComplete &&
    !snapshotIdMismatch;

  const hash = createHash("sha256");
  hash.update(`${verificationSnapshot ?? "none"}|${rehearsalSnapshot ?? "none"}|${attestationSnapshot ?? "none"}\n`);
  hash.update(`${verificationPassed}|${rehearsalPassed}|${transformReportPresent}|${idMapLines}|${attestationComplete}|${snapshotIdMismatch}\n`);

  return {
    snapshotId: verificationSnapshot,
    verificationPassed,
    rehearsalPassed,
    transformReportPresent,
    idMapLines,
    attestationComplete,
    missingAttestationFields: missingAttestationFields.sort(),
    snapshotIdMismatch,
    evidenceComplete,
    reviewItems: [
      {
        id: "not-a-restore-test",
        statement: "Evidence completeness does not prove a production restore; the owner attestation is a claim, not a tool-verified replay.",
      },
      {
        id: "financial-and-media",
        statement: "Financial and media reconciliation must be reviewed from the isolated restore output, not inferred from counts alone.",
      },
      {
        id: "rpo-rto",
        statement: "Measured RPO/RTO and access-control evidence remain owner artifacts outside this checker.",
      },
    ],
    digest: hash.digest("hex"),
  };
}
