#!/usr/bin/env node
/**
 * Report-only guard for Worker deployment configuration hygiene.
 *
 * Reads tracked Wrangler configs and prints finding identifiers only. It never
 * prints, copies or logs configuration values, including credential vars.
 * It checks observability, query-string redaction and wildcard CORS for the
 * staging/production configs; it is not a deployment or policy change.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIGS = [
  { stage: "staging", file: "apps/cloudflare-worker/wrangler.staging.jsonc" },
  { stage: "production", file: "apps/cloudflare-worker/wrangler.production.jsonc" },
];

function parseJsonc(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      if (index < text.length) output += "\n";
      continue;
    }
    output += char;
  }
  return JSON.parse(output.replace(/,(\s*[}\]])/g, "$1"));
}

export function checkWorkerConfig(content, stage) {
  const config = parseJsonc(content);
  const findings = [];
  const observability = config.observability ?? {};
  const logs = observability.logs ?? {};

  if (observability.enabled !== true) findings.push(`${stage}: observability not enabled`);
  if (logs.enabled !== true) findings.push(`${stage}: invocation logs not enabled`);
  if (logs.persist !== true) findings.push(`${stage}: logs not persisted`);
  if (observability.redact_query_string !== true) findings.push(`${stage}: query strings not redacted`);
  if (config.vars?.CORS_ORIGIN === "*") findings.push(`${stage}: wildcard CORS origin`);

  return { stage, findings, passed: findings.length === 0 };
}

async function main() {
  const root = process.cwd();
  const reports = [];
  for (const { stage, file } of CONFIGS) {
    try {
      const content = await readFile(path.resolve(root, file), "utf8");
      reports.push(checkWorkerConfig(content, stage));
    } catch (error) {
      reports.push({ stage, findings: [`${stage}: config unreadable`], passed: false });
      void error;
    }
  }

  const findings = reports.flatMap((report) => report.findings);
  console.log(`Worker config guard (report-only): ${findings.length} finding(s)`);
  for (const finding of findings) console.error(`  ${finding}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
