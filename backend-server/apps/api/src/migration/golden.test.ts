import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { toEnum, toIntegerMinorUnits, toSourceId, toUtcIso, TransformContext, type TransformField } from "./transform.js";

interface GoldenCase {
  name: string;
  input: Record<string, unknown>;
  expected: { sourceId: string | null; createdAt: string | null; coins: number | null; visibility: string | null };
  quarantine: string[];
}

const fixture = new URL("./golden/transform-cases.json", import.meta.url);
const cases = JSON.parse(await readFile(fileURLToPath(fixture), "utf8")) as { cases: GoldenCase[] };

test("golden fixtures reproduce deterministic transform output and quarantine reasons", async () => {
  assert.ok(cases.cases.length >= 3);
  for (const golden of cases.cases) {
    const context = new TransformContext("golden");
    const field = (name: string): TransformField => ({
      collection: "users",
      field: name,
      rowId: String(golden.input._id),
      context
    });
    const actual = {
      sourceId: toSourceId(golden.input._id, field("_id")) ?? null,
      createdAt: toUtcIso(golden.input.createdAt, field("createdAt")) ?? null,
      coins: toIntegerMinorUnits(golden.input.coins, field("coins")) ?? null,
      visibility: toEnum(golden.input.visibility, ["PUBLIC", "PRIVATE"] as const, field("visibility")) ?? null
    };
    assert.deepEqual(actual, golden.expected, golden.name);
    assert.deepEqual(context.quarantine.map((entry) => entry.reason), golden.quarantine, golden.name);
  }
});
