import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkOpenApi, REQUIRED_PATHS } from "./check-openapi.mjs";

function pathBlock() {
  return REQUIRED_PATHS.map(
    (route) => `  ${route}:\n    post:\n      responses:\n        "200":\n          description: ok\n`
  ).join("");
}

function specWithComponents(componentLines) {
  return `openapi: "3.0.3"\ncomponents:\n  schemas:\n    User:\n      type: object\n${componentLines}paths:\n${pathBlock()}`;
}

function validSpec() {
  return specWithComponents("");
}

test("accepts a structurally complete spec with resolved local refs", () => {
  const report = checkOpenApi(specWithComponents('      properties:\n        id: { type: string, $ref: "#/components/schemas/User" }\n'));

  assert.equal(report.passed, true);
  assert.deepEqual(report.findings, []);
  assert.equal(report.pathCount, REQUIRED_PATHS.length);
  assert.equal(report.schemaCount, 1);
  assert.equal(report.refCount, 1);
});

test("reports a missing required path", () => {
  const spec = validSpec().replace("  /media/uploads:\n", "");
  const report = checkOpenApi(spec);

  assert.equal(report.passed, false);
  assert.ok(report.findings.includes("missing required path: /media/uploads"));
});

test("reports unresolved local refs and duplicate schemas", () => {
  const spec = specWithComponents('      properties:\n        owner: { $ref: "#/components/schemas/Missing" }\n    User:\n      type: object\n');
  const report = checkOpenApi(spec);

  assert.equal(report.passed, false);
  assert.ok(report.findings.includes("unresolved local ref: #/components/schemas/Missing"));
  assert.ok(report.findings.includes("duplicate component schemas: User"));
});

test("reports duplicate paths", () => {
  const report = checkOpenApi(`${validSpec()}  /media/uploads:\n    get:\n      responses:\n        "200":\n          description: ok\n`);

  assert.equal(report.passed, false);
  assert.ok(report.findings.includes("duplicate path: /media/uploads"));
});

test("rejects embedded credentials in a server URL", () => {
  const report = checkOpenApi(`${validSpec()}servers:\n  - url: https://user:pass@example.test/api\n`);

  assert.equal(report.passed, false);
  assert.ok(report.findings.includes("server URL contains embedded credentials"));
});

test("CLI reads a local file and exits non-zero on findings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-openapi-guard-"));
  const file = path.join(directory, "openapi.yaml");
  try {
    await writeFile(file, validSpec(), "utf8");
    const { execFileSync } = await import("node:child_process");
    const script = path.resolve("scripts/check-openapi.mjs");

    const output = execFileSync(process.execPath, [script, file], { encoding: "utf8" });
    assert.match(output, /OpenAPI guard: PASS/);

    await writeFile(file, validSpec().replace("  /auth/verify-otp:\n", ""), "utf8");
    assert.throws(
      () => execFileSync(process.execPath, [script, file], { encoding: "utf8", stdio: "pipe" }),
      (error) => error.status === 1
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
