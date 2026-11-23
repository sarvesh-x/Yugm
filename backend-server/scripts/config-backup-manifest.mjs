#!/usr/bin/env node
/**
 * Value-free manifest of tracked configuration files for Phase 1 recovery prep.
 *
 * Records path, byte count and SHA-256 only. It never prints, copies or logs
 * file contents or secret values, and it is not itself a config backup: ignored
 * `.env`/`.dev.vars` values and external provider config remain owner-managed.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { trackedConfigFiles } from "./check-tracked-secrets.mjs";

export async function createConfigManifest(files) {
  const entries = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(file.absolute);
      return {
        path: file.display.replace(/\\/g, "/"),
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      };
    })
  );
  entries.sort((a, b) => a.path.localeCompare(b.path));

  const hash = createHash("sha256");
  for (const entry of entries) hash.update(`${entry.path}:${entry.bytes}:${entry.sha256}\n`);
  return {
    generatedAt: new Date().toISOString(),
    trackedOnly: true,
    fileCount: entries.length,
    entries,
    digest: hash.digest("hex"),
  };
}

async function main() {
  const outIndex = process.argv.indexOf("--out");
  const out = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  if (outIndex >= 0 && !out) {
    console.error("Missing --out <report.json>");
    process.exit(1);
  }

  const manifest = await createConfigManifest(trackedConfigFiles());
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  if (out) {
    const target = path.resolve(out);
    await writeFile(target, json, "utf8");
    console.log(`Wrote config manifest to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(`Config manifest: ${manifest.fileCount} tracked config file(s); digest ${manifest.digest}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
