import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  "persist-to": { type: "string" },
  port: { type: "string", default: "4000" },
  "env-file": { type: "string", multiple: true, default: [] },
  "inspector-port": { type: "string" }
} });

const config = fileURLToPath(new URL("../apps/cloudflare-worker/auth-local/wrangler.jsonc", import.meta.url));
const persistTo = values["persist-to"]
  ? resolve(values["persist-to"])
  : resolve(dirname(config), ".wrangler", "state");
const require = createRequire(import.meta.url);
const wrangler = resolve(dirname(require.resolve("wrangler/package.json")), "bin", "wrangler.js");
const localArgs = ["--config", config, "--local", "--persist-to", persistTo];

// Let Wrangler apply only pending migrations before workerd opens this same state.
const setup = spawnSync(process.execPath, [wrangler, "d1", "migrations", "apply", "yugm", ...localArgs], {
  stdio: ["ignore", "inherit", "inherit"]
});
if (setup.status !== 0) {
  console.error(`Local D1 setup failed for ${persistTo}. Check the migration output above.${setup.error ? ` ${setup.error.message}` : ""}`);
  process.exit(setup.status ?? 1);
}

const devArgs = ["--ip", "127.0.0.1", "--port", values.port];
for (const envFile of values["env-file"]) devArgs.push("--env-file", resolve(envFile));
if (values["inspector-port"]) devArgs.push("--inspector-port", values["inspector-port"]);
const worker = spawn(process.execPath, [wrangler, "dev", ...localArgs, ...devArgs], { stdio: "inherit" });
worker.on("error", error => {
  console.error(error.message);
  process.exitCode = 1;
});
worker.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
