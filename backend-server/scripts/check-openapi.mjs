#!/usr/bin/env node
/**
 * Dependency-free structural guard for apps/api/openapi.yaml.
 *
 * This is not a full OpenAPI validator. It checks the migration-critical
 * surface: OpenAPI 3 version, required media/admin/auth paths, duplicate paths
 * or schemas, local component $ref targets and embedded server credentials.
 * It reads only the supplied local file and prints no values.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_PATHS = [
  "/auth/request-otp",
  "/auth/verify-otp",
  "/media/uploads",
  "/media/uploads/{sessionId}/complete",
  "/media/uploads/{sessionId}",
  "/media/{mediaId}/download",
  "/admin/assets",
  "/admin/assets/staging/{fileName}",
];

export function checkOpenApi(content) {
  const findings = [];
  const paths = new Map();
  const components = new Map();

  if (!/^openapi:\s*["']?3\./m.test(content)) findings.push("missing or non-3.x openapi version");

  let topLevel = null;
  let componentSection = null;
  for (const line of content.split(/\r?\n/)) {
    const top = /^([A-Za-z0-9_]+):\s*$/.exec(line);
    if (top) {
      topLevel = top[1];
      componentSection = null;
      continue;
    }

    if (topLevel === "paths") {
      const route = /^  (\/[^\s:]*):\s*$/.exec(line);
      if (route) {
        if (paths.has(route[1])) findings.push(`duplicate path: ${route[1]}`);
        paths.set(route[1], true);
      }
    }

    if (topLevel === "components") {
      const section = /^  ([A-Za-z0-9_]+):\s*$/.exec(line);
      if (section) {
        componentSection = section[1];
        if (!components.has(componentSection)) components.set(componentSection, new Map());
        continue;
      }
      const component = /^    ([A-Za-z0-9_]+):\s*$/.exec(line);
      if (component && componentSection) {
        const names = components.get(componentSection);
        if (names.has(component[1])) findings.push(`duplicate component ${componentSection}: ${component[1]}`);
        names.set(component[1], true);
      }
    }
  }

  for (const required of REQUIRED_PATHS) {
    if (!paths.has(required)) findings.push(`missing required path: ${required}`);
  }

  const refs = [...content.matchAll(/#\/components\/([A-Za-z0-9_]+)\/([A-Za-z0-9_]+)/g)];
  for (const [, section, name] of refs) {
    if (!components.get(section)?.has(name)) findings.push(`unresolved local ref: #/components/${section}/${name}`);
  }

  if (/:\/\/[^/\s:@]+:[^/\s@]+@/.test(content)) {
    findings.push("server URL contains embedded credentials");
  }

  return {
    openapiVersion: /^openapi:\s*["']?([^"'\s]+)/m.exec(content)?.[1] ?? null,
    pathCount: paths.size,
    schemaCount: components.get("schemas")?.size ?? 0,
    refCount: refs.length,
    findings,
    passed: findings.length === 0,
  };
}

async function main() {
  const file = process.argv[2] ?? "apps/api/openapi.yaml";
  let content;
  try {
    content = await readFile(path.resolve(file), "utf8");
  } catch (error) {
    console.error(`Cannot read OpenAPI file: ${file}`);
    process.exit(1);
  }

  const report = checkOpenApi(content);
  console.log(
    `OpenAPI guard: ${report.passed ? "PASS" : "FAIL"} (${report.openapiVersion ?? "unknown"}; ` +
      `${report.pathCount} paths, ${report.schemaCount} schemas, ${report.refCount} local refs)`
  );
  for (const finding of report.findings) console.error(`  FAIL ${finding}`);
  if (!report.passed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
