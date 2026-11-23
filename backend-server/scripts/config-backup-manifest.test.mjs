import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createConfigManifest } from "./config-backup-manifest.mjs";
import { isCandidate } from "./check-tracked-secrets.mjs";

async function fileSet(directory) {
  const files = [
    { display: "apps/api/.env.example", absolute: path.join(directory, "env.example") },
    { display: "wrangler.jsonc", absolute: path.join(directory, "wrangler.jsonc") },
  ];
  await writeFile(files[0].absolute, "PUBLIC_URL=https://example.test/api\n", "utf8");
  await writeFile(files[1].absolute, "{ \"name\": \"yugm\" }\n", "utf8");
  return files;
}

test("manifest records path, bytes and hash only, in stable order", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-config-manifest-"));
  try {
    const files = await fileSet(directory);
    const first = await createConfigManifest(files);
    const reversed = await createConfigManifest([...files].reverse());

    assert.equal(first.fileCount, 2);
    assert.deepEqual(first.entries.map((entry) => entry.path), ["apps/api/.env.example", "wrangler.jsonc"]);
    assert.equal(first.digest, reversed.digest);
    assert.match(first.digest, /^[a-f0-9]{64}$/);
    for (const entry of first.entries) {
      assert.match(entry.sha256, /^[a-f0-9]{64}$/);
      assert.ok(entry.bytes > 0);
      assert.ok(!JSON.stringify(entry).includes("example.test/api"));
    }
    const expected = createHash("sha256").update("{ \"name\": \"yugm\" }\n").digest("hex");
    assert.equal(first.entries[1].sha256, expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("candidate filter still covers tracked config file types", () => {
  assert.equal(isCandidate("apps/cloudflare-worker/wrangler.jsonc"), true);
  assert.equal(isCandidate("docs/README.md"), false);
  assert.equal(isCandidate("backend-server/.env.local"), true);
  assert.equal(isCandidate("package-lock.json"), false);
});

test("CLI writes a value-free manifest for the tracked repository config files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-config-manifest-cli-"));
  const output = path.join(directory, "manifest.json");
  try {
    const stdout = execFileSync(process.execPath, [path.resolve("scripts/config-backup-manifest.mjs"), "--out", output], {
      cwd: path.resolve(".."),
      encoding: "utf8",
    });
    const manifest = JSON.parse(await readFile(output, "utf8"));

    assert.match(stdout, /Wrote config manifest/);
    assert.ok(manifest.fileCount > 0);
    assert.equal(manifest.trackedOnly, true);
    assert.ok(manifest.entries.every((entry) => typeof entry.sha256 === "string" && entry.sha256.length === 64));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
