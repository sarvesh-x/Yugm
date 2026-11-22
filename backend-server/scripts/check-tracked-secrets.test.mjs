import test from "node:test";
import assert from "node:assert/strict";

import { isCandidate, isPlaceholder, isSecretKey, scanText } from "./check-tracked-secrets.mjs";

test("flags a plaintext credential in JSONC and reports only its name and line", () => {
  const text = [
    "{",
    '  "vars": {',
    '    "JWT_SECRET": "super-secret-value-123456",',
    '    "CORS_ORIGIN": "*"',
    "  }",
    "}",
  ].join("\n");

  const findings = scanText("wrangler.jsonc", text);

  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0], { file: "wrangler.jsonc", line: 3, variable: "JWT_SECRET" });
  assert.ok(!JSON.stringify(findings).includes("super-secret-value"), "value must never appear in a finding");
});

test("flags an exact legacy key with a remote connection string", () => {
  const findings = scanText("wrangler.jsonc", '{"MONGODB_URI": "mongodb+srv://user:pw@cluster.example.com/yugm"}');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].variable, "MONGODB_URI");
});

test("ignores placeholders, env references, generated values and loopback defaults", () => {
  const text = [
    'JWT_SECRET: "${{ secrets.JWT_SECRET }}"',
    "ADMIN_REFRESH_SECRET: your-value-here",
    "SEED_SUPER_ADMIN_PASSWORD: change-me",
    "MONGODB_URI: mongodb://127.0.0.1:27017/yugm-unit-tests",
    "LIVEKIT_API_SECRET: generateValue",
    "S3_SECRET_ACCESS_KEY: <set-in-secret-store>",
    "MONGODB_URI: mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/yugm",
  ].join("\n");
  assert.deepEqual(scanText("config.yml", text), []);
});

test("ignores non-secret identifiers and public configuration", () => {
  assert.equal(isSecretKey("RAZORPAY_KEY_ID"), false);
  assert.equal(isSecretKey("GOOGLE_PLAY_PACKAGE_NAME"), false);
  assert.equal(isSecretKey("CLOUDFLARE_ACCOUNT_ID"), false);
  assert.equal(isSecretKey("LIVEKIT_URL"), false);
  assert.equal(isSecretKey("R2_ASSETS_PUBLIC_URL"), false);
});

test("recognises generic sensitive suffixes but not ordinary settings", () => {
  assert.equal(isSecretKey("PAYOUT_KYC_ENCRYPTION_KEY"), true);
  assert.equal(isSecretKey("DARKSKY_WEBHOOK_SECRET"), true);
  assert.equal(isSecretKey("DEV_BYPASS_OTP"), true);
  assert.equal(isSecretKey("STORAGE_DRIVER"), false);
  assert.equal(isSecretKey("YUGM_STAGE"), false);
});

test("does not treat CI secret references as assignments", () => {
  const text = [
    "env:",
    "  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    '  token: "${{ secrets.CLOUDFLARE_API_TOKEN }}"',
  ].join("\n");
  assert.deepEqual(scanText("ci.yml", text), []);
});

test("placeholder detection is value-only and does not leak the input", () => {
  assert.equal(isPlaceholder(""), true);
  assert.equal(isPlaceholder('"${JWT_SECRET}"'), true);
  assert.equal(isPlaceholder("example-key"), true);
  assert.equal(isPlaceholder("a-real-looking-value"), false);
});

test("candidate selection covers config files but excludes docs and lockfiles", () => {
  assert.equal(isCandidate("backend-server/apps/cloudflare-worker/wrangler.jsonc"), true);
  assert.equal(isCandidate("backend-server/apps/api/.env.example"), true);
  assert.equal(isCandidate(".github/workflows/ci.yml"), true);
  assert.equal(isCandidate("docs/infrastructure/tracked-worker-credentials-finding.md"), false);
  assert.equal(isCandidate("backend-server/package-lock.json"), false);
  assert.equal(isCandidate("backend-server/node_modules/x/wrangler.jsonc"), false);
});
