import assert from "node:assert/strict";
import test from "node:test";
import { SerializedOperations } from "./serializedOperations.js";

test("serialises overlapping async work in call order", async () => {
  const queue = new SerializedOperations();
  const events: string[] = [];

  const first = queue.run(async () => {
    events.push("start-1");
    await Promise.resolve();
    events.push("end-1");
    return 1;
  });
  const second = queue.run(async () => {
    events.push("start-2");
    await Promise.resolve();
    events.push("end-2");
    return 2;
  });

  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, ["start-1", "end-1", "start-2", "end-2"]);
});

test("a rejected unit does not block later units", async () => {
  const queue = new SerializedOperations();
  const rejected = queue.run(async () => { throw new Error("boom"); });
  await assert.rejects(rejected, /boom/);

  const after = await queue.run(async () => "ok");
  assert.equal(after, "ok");
});
