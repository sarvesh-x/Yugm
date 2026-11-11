const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const backendRoot = path.resolve(__dirname, "..");
const requiredPackages = [
  "node_modules/@types/node/package.json",
  "node_modules/@yugm/shared/package.json",
  "node_modules/express/package.json",
  "node_modules/mongoose/package.json"
];
const missing = requiredPackages.filter((relativePath) => !existsSync(path.join(backendRoot, relativePath)));

if (missing.length) {
  console.log(`Installing backend workspace dependencies before compiling (missing: ${missing.join(", ")})`);
  const result = spawnSync("npm", ["ci", "--include=dev"], {
    cwd: backendRoot,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
