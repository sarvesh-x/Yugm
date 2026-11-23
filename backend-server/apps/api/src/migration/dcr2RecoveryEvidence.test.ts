import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assessRecoveryEvidence, RECOVERY_ATTESTATION_BOOLEANS } from "./dcr2RecoveryEvidence.js";

async function fixture(attestationOverrides: Record<string, unknown> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "yugm-recovery-evidence-"));
  const rehearsal = path.join(root, "rehearsal");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(rehearsal));
  const verificationFile = path.join(root, "verification.json");
  const attestationFile = path.join(root, "attestation.json");

  await writeFile(verificationFile, JSON.stringify({ snapshotId: "snap-1", passed: true }), "utf8");
  await writeFile(path.join(rehearsal, "validation-report.json"), JSON.stringify({ snapshotId: "snap-1", passed: true }), "utf8");
  await writeFile(path.join(rehearsal, "transform-report.json"), JSON.stringify({ snapshotId: "snap-1" }), "utf8");
  await writeFile(path.join(rehearsal, "id-map.jsonl"), '{"collection":"users"}\n', "utf8");

  const attestation: Record<string, unknown> = {
    snapshotId: "snap-1",
    owner: "owner@example.test",
    date: "2026-11-23",
    ...Object.fromEntries(RECOVERY_ATTESTATION_BOOLEANS.map((field) => [field, true])),
    ...attestationOverrides,
  };
  await writeFile(attestationFile, JSON.stringify(attestation), "utf8");

  return { root, verificationFile, rehearsalDirectory: rehearsal, attestationFile };
}

test("recognizes complete recovery evidence", async () => {
  const inputs = await fixture();
  try {
    const report = await assessRecoveryEvidence(inputs);

    assert.equal(report.evidenceComplete, true);
    assert.equal(report.snapshotId, "snap-1");
    assert.equal(report.idMapLines, 1);
    assert.equal(report.attestationComplete, true);
    assert.match(report.digest, /^[a-f0-9]{64}$/);
  } finally {
    await rm(inputs.root, { recursive: true, force: true });
  }
});

test("reports missing attestation booleans and snapshot mismatch", async () => {
  const inputs = await fixture({
    financialReconciliationPassed: false,
    mediaReferenceResolutionPassed: undefined,
    snapshotId: "snap-2",
  });
  try {
    const report = await assessRecoveryEvidence(inputs);

    assert.equal(report.evidenceComplete, false);
    assert.ok(report.missingAttestationFields.includes("financialReconciliationPassed"));
    assert.ok(report.missingAttestationFields.includes("mediaReferenceResolutionPassed"));
    assert.equal(report.snapshotIdMismatch, true);
  } finally {
    await rm(inputs.root, { recursive: true, force: true });
  }
});

test("fails when rehearsal artifacts are missing", async () => {
  const inputs = await fixture();
  try {
    await rm(path.join(inputs.rehearsalDirectory, "id-map.jsonl"));
    const report = await assessRecoveryEvidence(inputs);

    assert.equal(report.evidenceComplete, false);
    assert.equal(report.idMapLines, 0);
  } finally {
    await rm(inputs.root, { recursive: true, force: true });
  }
});
