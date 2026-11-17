import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Never load .env or accept an external Mongo URI. This runner owns a temporary
// loopback replica set and passes only OS essentials plus test configuration.
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let replica;
try {
  replica = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" }
  });
  const osKeys = new Set(["path", "systemroot", "windir", "comspec", "pathext", "temp", "tmp", "userprofile", "home", "appdata", "localappdata"]);
  const isolatedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => osKeys.has(key.toLowerCase())));
  Object.assign(isolatedEnv, {
    NODE_ENV: "test",
    DOTENV_CONFIG_PATH: path.join(apiRoot, "test", ".nonexistent-test-env"),
    YUGM_HARDENING_TEST: "1",
    MONGODB_URI: replica.getUri(),
    MONGODB_DB_NAME: `yugm_hardening_${randomUUID().replaceAll("-", "")}`,
    JWT_SECRET: `isolated-hardening-${randomUUID()}`,
    RAZORPAY_WEBHOOK_SECRET: "isolated-provider-fixture-secret",
    REDIS_URL: "",
    STORAGE_DRIVER: "local",
    LIVEKIT_URL: "ws://127.0.0.1:1"
  });
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--test", "src/test/productionHardening.integration.ts"], {
      cwd: apiRoot, env: isolatedEnv, stdio: "inherit", windowsHide: true
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
  process.exitCode = exitCode;
} finally {
  await replica?.stop();
}
