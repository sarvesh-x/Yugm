import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { unstable_dev } from "wrangler";

test("local Queues and Durable Object push outbox", async (t) => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "yugm-push-queue-"));
  const config = join(directory, "wrangler.jsonc");
  const fixture = fileURLToPath(new URL("./push-queue.fixture.mjs", import.meta.url));
  const queue = "fixture-push";
  await writeFile(config, JSON.stringify({
    name: "yugm-push-queue-fixture",
    main: fixture,
    compatibility_date: "2026-08-04",
    durable_objects: {
      bindings: [
        { name: "API_SERVICE", class_name: "FixtureDelivery" },
        { name: "PUSH_OUTBOX", class_name: "FixtureOutbox" }
      ]
    },
    migrations: [{ tag: "v1", new_sqlite_classes: ["FixtureDelivery", "FixtureOutbox"] }],
    queues: {
      producers: [{ binding: "PUSH_QUEUE", queue }],
      consumers: [{ queue, max_batch_timeout: 0 }]
    }
  }));
  let worker;
  try {
    worker = await unstable_dev(fixture, {
      config, local: true, persist: false, port: 0, logLevel: "error",
      experimental: { disableExperimentalWarning: true, disableDevRegistry: true }
    });
    async function request(path, id, options = {}) {
      const query = new URLSearchParams({ id, ...options });
      return worker.fetch(`${path}?${query}`);
    }

    async function observe(id, predicate) {
      const deadline = Date.now() + 5_000;
      let observed;
      do {
        const response = await request("/observe", id);
        assert.equal(response.status, 200);
        observed = await response.json();
        if (predicate(observed)) return observed;
        await sleep(30);
      } while (Date.now() < deadline);
      assert.fail(`Outbox did not reach expected state: ${JSON.stringify(observed)}`);
    }

    await t.test("initial enqueue and duplicate broker delivery send only once", async () => {
      const id = "000000000000000000000001";
      assert.equal((await request("/enqueue", id)).status, 204);
      const delivered = await observe(id, (value) => value.status === "completed" && value.processed === 1);
      assert.deepEqual(delivered.attempts, [[]]);
      assert.equal((await request("/recover", id, { ms: 0 })).status, 204);
      assert.equal((await request("/enqueue", id)).status, 204);
      assert.equal((await request("/duplicate", id)).status, 204);
      const duplicate = await observe(id, (value) => value.processed === 2);
      assert.deepEqual(duplicate.attempts, [[]]);
      assert.equal(await (await request("/replay", id)).json(), false);
    });

    await t.test("retry keeps only the transient multicast devices", async () => {
      const id = "000000000000000000000002";
      assert.equal((await request("/enqueue", id, { title: "partial" })).status, 204);
      await observe(id, (value) => value.processed === 1 && value.status === "pending");
      assert.equal((await request("/duplicate", id)).status, 204);
      assert.deepEqual((await observe(id, (value) => value.processed === 2)).attempts, [[]]);
      assert.equal((await request("/recover", id, { ms: 61_000 })).status, 204);
      const delivered = await observe(id, (value) => value.processed === 3 && value.status === "completed");
      assert.deepEqual(delivered.attempts, [[], ["transient-device"]]);
    });

    await t.test("permanent provider failures are terminal and do not replay", async () => {
      const id = "000000000000000000000006";
      assert.equal((await request("/enqueue", id, { title: "permanent" })).status, 204);
      const terminal = await observe(id, (value) => value.status === "completed-with-failures" && value.processed === 1);
      assert.deepEqual(terminal.attempts, [[]]);
      assert.equal(await (await request("/replay", id)).json(), false);
    });

    await t.test("broker publish failure leaves a recoverable pending record", async () => {
      const id = "000000000000000000000003";
      assert.equal((await request("/fail-enqueue", id)).status, 503);
      assert.deepEqual(await observe(id, (value) => value.status === "pending"), {
        status: "pending", attempts: [], processed: 0
      });
      assert.equal((await request("/recover", id, { ms: 901_000 })).status, 204);
      assert.deepEqual((await observe(id, (value) => value.status === "completed")).attempts, [[]]);
    });

    await t.test("exhausted and expired jobs can be explicitly replayed", async () => {
      const terminal = "000000000000000000000004";
      assert.equal((await request("/enqueue", terminal, { title: "terminal" })).status, 204);
      await observe(terminal, (value) => value.processed === 1);
      assert.equal((await request("/recover", terminal, { ms: 61_000 })).status, 204);
      await observe(terminal, (value) => value.processed === 2);
      assert.equal((await request("/recover", terminal, { ms: 121_000 })).status, 204);
      const failed = await observe(terminal, (value) => value.processed === 3 && value.status === "failed");
      assert.deepEqual(failed.attempts, [[], ["transient-device"], ["transient-device"]]);
      assert.equal(await (await request("/replay", terminal)).json(), true);
      assert.deepEqual((await observe(terminal, (value) => value.status === "completed")).attempts.at(-1), ["transient-device"]);

      const expired = "000000000000000000000005";
      assert.equal((await request("/fail-enqueue", expired)).status, 503);
      assert.equal((await request("/recover", expired, { ms: 86_401_000 })).status, 204);
      assert.deepEqual(await observe(expired, (value) => value.status === "failed"), {
        status: "failed", attempts: [], processed: 0
      });
      assert.equal(await (await request("/replay", expired)).json(), true);
      assert.deepEqual((await observe(expired, (value) => value.status === "completed")).attempts, [[]]);
    });
  } finally {
    await worker?.stop();
    const resolved = await realpath(directory);
    assert.equal(dirname(resolved), temporaryRoot);
    assert.ok(basename(resolved).startsWith("yugm-push-queue-"));
    await rm(resolved, { recursive: true, force: true, maxRetries: 3 });
  }
});
