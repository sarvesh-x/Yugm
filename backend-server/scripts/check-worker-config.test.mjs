import assert from "node:assert/strict";
import { test } from "node:test";
import { checkWorkerConfig } from "./check-worker-config.mjs";

function config(overrides = {}) {
  return {
    observability: {
      enabled: true,
      head_sampling_rate: 1,
      redact_query_string: true,
      logs: { enabled: true, head_sampling_rate: 1, invocation_logs: true, persist: true },
    },
    vars: { YUGM_STAGE: "staging", CORS_ORIGIN: "https://admin.example.test" },
    ...overrides,
  };
}

test("accepts a hardened staging config", () => {
  const result = checkWorkerConfig(JSON.stringify(config()), "staging");

  assert.deepEqual(result.findings, []);
  assert.equal(result.passed, true);
});

test("reports query-string redaction and wildcard CORS findings", () => {
  const value = config({
    observability: {
      enabled: true,
      redact_query_string: false,
      logs: { enabled: true, persist: true },
    },
    vars: { CORS_ORIGIN: "*" },
  });
  const result = checkWorkerConfig(JSON.stringify(value), "staging");

  assert.deepEqual(result.findings, [
    "staging: query strings not redacted",
    "staging: wildcard CORS origin",
  ]);
});

test("reports missing observability for a production-like config", () => {
  const result = checkWorkerConfig(JSON.stringify({ vars: { CORS_ORIGIN: "https://admin.example.test" } }), "production");

  assert.deepEqual(result.findings, [
    "production: observability not enabled",
    "production: invocation logs not enabled",
    "production: logs not persisted",
    "production: query strings not redacted",
  ]);
});

test("parses JSONC comments and trailing commas", () => {
  const text = `{
    // comment
    "observability": { "enabled": true, "redact_query_string": true, "logs": { "enabled": true, "persist": true, }, },
    "vars": { "CORS_ORIGIN": "https://admin.example.test", },
  }`;
  const result = checkWorkerConfig(text, "staging");

  assert.equal(result.passed, true);
});

test("never emits configuration values in a report", () => {
  const value = config({ vars: { CORS_ORIGIN: "https://admin.example.test", FAKE_SECRET: "do-not-emit-this-value" } });
  const result = checkWorkerConfig(JSON.stringify(value), "staging");

  assert.ok(!JSON.stringify(result).includes("do-not-emit-this-value"));
});
