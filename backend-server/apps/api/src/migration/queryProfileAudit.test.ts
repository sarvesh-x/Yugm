import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  buildQueryProfile,
  parseQueryObservation,
  readQueryProfileInput,
  type QueryObservation,
} from "./queryProfileAudit.js";

const observation = (overrides: Partial<QueryObservation> = {}): QueryObservation => ({
  id: "q1",
  pattern: "find user by id",
  frequencyPerMinute: 60,
  rowsScanned: 1,
  rowsReturned: 1,
  durationMs: 10,
  resultBytes: 2_000,
  statementBytes: 1_000,
  boundParameters: 1,
  usesIndex: true,
  fullCollectionScan: false,
  ...overrides,
});

test("screens hard limits and reports percentile/headroom evidence", () => {
  const report = buildQueryProfile(
    [
      observation(),
      observation({ id: "q2", frequencyPerMinute: 120, durationMs: 20, rowsScanned: 50, fullCollectionScan: true, usesIndex: false }),
    ],
    "fixture"
  );

  assert.equal(report.hardGatesPassed, true);
  assert.equal(report.recordCount, 2);
  assert.equal(report.totalFrequencyPerMinute, 180);
  assert.equal(report.demandQps, 3);
  assert.equal(report.percentiles.p99Ms, 20);
  assert.equal(report.maxRowsScanned, 50);
  assert.equal(report.fullScanCount, 1);
  assert.equal(report.unindexedCount, 1);
  assert.deepEqual(
    report.reviewItems.map((item) => item.id),
    ["indexed-query-shape", "rows-scanned-billing", "throughput-headroom", "query-duration-comfort"]
  );
});

test("fails hard gates for oversized statements, parameters, results and durations", () => {
  const report = buildQueryProfile(
    [
      observation({
        statementBytes: 100_001,
        boundParameters: 101,
        resultBytes: 50_000_001,
        durationMs: 30_001,
      }),
    ],
    "over-limit"
  );

  assert.equal(report.hardGatesPassed, false);
  assert.equal(report.checks.filter((check) => !check.passed).length, 4);
});

test("parse rejects missing or invalid fields", () => {
  assert.throws(() => parseQueryObservation({ ...observation(), durationMs: -1 }), /durationMs/);
  assert.throws(() => parseQueryObservation({ ...observation(), usesIndex: "yes" }), /usesIndex/);
  assert.throws(() => parseQueryObservation({ id: "q1" }), /pattern/);
});

test("reads JSONL observations from a local file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-query-profile-"));
  const file = path.join(directory, "queries.jsonl");
  try {
    await writeFile(file, `${JSON.stringify(observation())}\n`, "utf8");
    const input = await readQueryProfileInput(file);

    assert.equal(input.source, "queries.jsonl");
    assert.equal(input.records.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
