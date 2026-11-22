#!/usr/bin/env node
/**
 * Value-free regression guard for credential-bearing assignments in tracked config files.
 *
 * This script reports VARIABLE NAMES AND LINE NUMBERS ONLY. It never prints, stores,
 * logs or transforms an assigned value. It exists to catch a repeat of the DCR-1
 * finding (secrets committed in tracked Wrangler/env config), not to validate secrets.
 *
 * Usage:
 *   node scripts/check-tracked-secrets.mjs            # report, exit 0
 *   node scripts/check-tracked-secrets.mjs --strict   # report, exit 1 if findings
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Exact names that must never carry a real value in a tracked file. */
export const EXACT_SECRET_KEYS = new Set([
  "MONGODB_URI",
  "REDIS_URL",
  "JWT_SECRET",
  "ADMIN_JWT_SECRET",
  "ADMIN_REFRESH_SECRET",
  "DEV_BYPASS_OTP",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "FCM_PRIVATE_KEY",
  "FCM_CLIENT_EMAIL",
  "GOOGLE_PLAY_PRIVATE_KEY",
  "GOOGLE_PLAY_CLIENT_EMAIL",
  "PAYOUT_KYC_ENCRYPTION_KEY",
  "SEED_SUPER_ADMIN_PASSWORD",
  "R2_SECRET_ACCESS_KEY",
  "R2_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_ACCESS_KEY_ID",
]);

/** Names that are identifiers or public configuration, not credentials. */
const NON_SECRET_ALLOWLIST = new Set([
  "RAZORPAY_KEY_ID",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_PUBSUB_AUDIENCE",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCOUNT_ID",
  "FCM_PROJECT_ID",
  "YUGM_FACEBOOK_APP_ID",
  "LIVEKIT_URL",
  "S3_PUBLIC_BASE_URL",
  "R2_ASSETS_PUBLIC_URL",
  "R2_MEDIA_PUBLIC_URL",
]);

const SENSITIVE_SUFFIXES = [
  /_SECRET$/,
  /_PASSWORD$/,
  /_PRIVATE_KEY$/,
  /_TOKEN$/,
  /_API_KEY$/,
  /_ENCRYPTION_KEY$/,
  /_WEBHOOK_SECRET$/,
  /_ACCESS_KEY_ID$/,
  /_CLIENT_EMAIL$/,
  /_OTP$/,
];

// Matches `KEY: value`, `"KEY": "value"`, `KEY = value` and `KEY=value`.
// The optional quote before the separator is required for JSON/JSONC.
const ASSIGNMENT = /(?:^|[\s,{"])([A-Z][A-Z0-9_]{2,})\s*"?\s*[:=]\s*(.*)$/;

/** Return true when a variable name denotes a credential. */
export function isSecretKey(name) {
  if (NON_SECRET_ALLOWLIST.has(name)) return false;
  if (EXACT_SECRET_KEYS.has(name)) return true;
  return SENSITIVE_SUFFIXES.some((suffix) => suffix.test(name));
}

/** Return true when an assigned value is a placeholder, reference or local-only default. */
export function isPlaceholder(rawValue) {
  const value = rawValue
    .trim()
    .replace(/^["'`]+/, "")
    .replace(/["'`,;}\]]+$/, "")
    .trim();

  if (value.length === 0) return true;
  if (/^(\$\{|\{\{|\$)[^\n]*$/i.test(value)) return true;
  if (/^(true|false|null|undefined|0|none|n\/a|tbd)$/i.test(value)) return true;
  if (/^<[^>]*>$/.test(value)) return true;
  // Placeholder tokens must be the whole value or a clear prefix/suffix, not an
  // arbitrary substring: real hostnames can legitimately contain "example".
  if (/^(your|xxx+|example|sample|dummy|placeholder|redacted|todo|tbd)([-_][\w-]+)?$/i.test(value)) return true;
  if (/^(your|xxx|example|sample|dummy|placeholder|replace|change)[-_.\s]/i.test(value)) return true;
  if (/change[-_ ]?me|replace[-_ ]?me|redacted/i.test(value)) return true;
  if (/<[^>]+>|x{3,}/i.test(value)) return true;
  if (/generateValue|sync\s*:\s*false/i.test(value)) return true;
  // Loopback endpoints are local development configuration, not credentials.
  if (/^(mongodb|mongodb\+srv|redis|rediss|postgres(?:ql)?|mysql|http|https):\/\/(127\.0\.0\.1|localhost|\[::1\])\b/i.test(value)) return true;
  return false;
}

/**
 * Scan one file's text. Findings contain only { file, line, variable } — never the value.
 */
export function scanText(file, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = ASSIGNMENT.exec(lines[i]);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (!isSecretKey(name)) continue;
    if (isPlaceholder(rawValue)) continue;
    findings.push({ file, line: i + 1, variable: name });
  }
  return findings;
}

/** Whether a tracked path is a config-like file worth scanning. */
export function isCandidate(trackedPath) {
  const path = trackedPath.replace(/\\/g, "/");
  if (path.startsWith("docs/") || path.includes("/node_modules/") || path.startsWith("node_modules/")) return false;
  if (path.endsWith("package-lock.json")) return false;
  if (/\.(jsonc|json|yaml|yml|toml|properties)$/i.test(path)) return true;
  return /(^|\/)\.env(\..*)?$/i.test(path);
}

function trackedConfigFiles() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const raw = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return raw
    .split("\0")
    .filter(Boolean)
    .filter(isCandidate)
    .map((display) => ({ display, absolute: resolve(root, display) }));
}

function main(argv) {
  const strict = argv.includes("--strict");
  const files = trackedConfigFiles();
  const findings = [];

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file.absolute, "utf8");
    } catch {
      // A tracked file that cannot be read is reported by path only.
      findings.push({ file: file.display, line: 0, variable: "UNREADABLE_CONFIG_FILE" });
      continue;
    }
    findings.push(...scanText(file.display, text));
  }

  console.log(`Credential-hygiene check (value-free): scanned ${files.length} tracked config file(s).`);
  if (findings.length === 0) {
    console.log("No credential-bearing assignments found in tracked config files.");
    return;
  }

  console.log("Findings — variable names and locations only; values are never printed:");
  for (const finding of findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    console.log(`  ${location}  ${finding.variable}`);
  }
  console.log(`${findings.length} finding(s). ${strict ? "Failing in strict mode." : "Report-only; use --strict to fail."}`);
  if (strict) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
