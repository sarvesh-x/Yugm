import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { summarizeDcr2Readiness } from "./dcr2Readiness.js";

async function fixtures(overrides: Record<string, Record<string, unknown>> = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-dcr2-readiness-"));
  const reports: Record<string, string> = {};
  const defaults: Record<string, Record<string, unknown>> = {
    capacity: { hardGatesPassed: true, workersPaid: true, reviewItems: [{ id: "size" }, { id: "perf" }] },
    projection: { declaredAtLeastObserved: true, reviewItems: [{ id: "retention" }] },
    queries: { hardGatesPassed: true, reviewItems: [{ id: "index" }] },
    billing: { withinIncludedReads: true, withinIncludedWrites: true, withinIncludedStorage: true, reviewItems: [] },
    recovery: { evidenceComplete: true, reviewItems: [{ id: "restore" }] },
    attestation: { workersPaid: true, schemaApproved: true },
  };
  for (const [name, value] of Object.entries(defaults)) {
    const file = path.join(directory, `${name}.json`);
    await writeFile(file, JSON.stringify({ ...value, ...overrides[name] }), "utf8");
    reports[name] = file;
  }
  return { directory, reports };
}

test("summarizes complete DCR-2 readiness without claiming acceptance", async () => {
  const { directory, reports } = await fixtures();
  try {
    const report = await summarizeDcr2Readiness(reports as Parameters<typeof summarizeDcr2Readiness>[0]);

    assert.equal(report.ready, true);
    assert.equal(report.checks.length, 8);
    assert.ok(report.checks.every((entry) => entry.passed));
    assert.equal(report.openReviewItemCount, 5);
    assert.match(report.digest, /^[a-f0-9]{64}$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports failed checks for missing evidence and attestations", async () => {
  const { directory, reports } = await fixtures({
    capacity: { hardGatesPassed: false, workersPaid: true, reviewItems: [] },
    attestation: { workersPaid: false, schemaApproved: false },
    recovery: { evidenceComplete: false, reviewItems: [] },
  });
  try {
    const report = await summarizeDcr2Readiness(reports as Parameters<typeof summarizeDcr2Readiness>[0]);

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks.filter((entry) => !entry.passed).map((entry) => entry.id),
      ["capacity-hard-limits", "recovery-evidence", "owner-workers-paid", "owner-schema-approved"]
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
