import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { NativeCollectionReader, type NativeCollectionLike } from "./nativeCollectionReader.js";

const ID_A = new Types.ObjectId();
const ID_B = new Types.ObjectId();

function fakeCollection(records: Array<Record<string, unknown>>): NativeCollectionLike {
  return {
    async countDocuments() { return records.length; },
    find(filter: Record<string, unknown>) {
      const gt = (filter._id as { $gt?: unknown } | undefined)?.$gt;
      const matching = gt === undefined
        ? records
        : records.filter((record) => String(record._id) > String(gt));
      return {
        sort() {
          return {
            limit(count: number) {
              return { async toArray() { return matching.slice(0, count); } };
            },
          };
        },
      };
    },
  };
}

test("reads keyset batches by ObjectId cursor and counts source records", async () => {
  const collection = fakeCollection([
    { _id: ID_A, name: "one" },
    { _id: ID_B, name: "two" },
  ]);
  const reader = new NativeCollectionReader("users", collection);

  assert.equal(await reader.count(), 2);
  const first = await reader.readBatch(undefined, 1);
  assert.equal(first.length, 1);
  assert.equal(String(first[0]._id), ID_A.toHexString());

  const second = await reader.readBatch(ID_A.toHexString(), 1);
  assert.equal(second.length, 1);
  assert.equal(String(second[0]._id), ID_B.toHexString());
});

test("handles canonical string ids without ObjectId casting", async () => {
  const collection = fakeCollection([
    { _id: "media-1" },
    { _id: "media-2" },
  ]);
  const reader = new NativeCollectionReader("media_objects", collection, { stringIds: true });
  const first = await reader.readBatch(undefined, 1);
  const second = await reader.readBatch("media-1", 1);

  assert.equal(first[0]._id, "media-1");
  assert.equal(second[0]._id, "media-2");
});

test("rejects an invalid batch limit without touching the collection", async () => {
  const reader = new NativeCollectionReader("users", fakeCollection([]));
  await assert.rejects(() => reader.readBatch(undefined, 0), /positive integer/);
});
