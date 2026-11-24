import assert from "node:assert/strict";
import { Types } from "mongoose";
import { test } from "node:test";
import { D1TargetWriter, type D1BoundStatement, type D1Like } from "./d1Target.js";
import { MongoCollectionReader, type MongoModelLike } from "./mongoSource.js";
import type { SourceRecord } from "./types.js";

class FakeStatement implements D1BoundStatement {
  constructor(readonly sql: string, readonly values: unknown[], private readonly owner: FakeD1) {}
  async run() {
    this.owner.runs.push(this);
    return {};
  }
}

class FakeD1 implements D1Like {
  readonly runs: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  prepare(sql: string) {
    return {
      bind: (...values: unknown[]) => new FakeStatement(sql, values, this)
    };
  }
  async batch(statements: readonly D1BoundStatement[]) {
    this.batches.push([...statements] as FakeStatement[]);
    return [];
  }
}

test("D1 writer quotes identifiers, chunks to the 100-parameter limit and binds values", async () => {
  const db = new FakeD1();
  const rows = Array.from({ length: 70 }, (_, index) => ({
    source_id: String(index).padStart(24, "0"),
    name: `user-${index}`,
    coins: index
  }));
  await new D1TargetWriter(db).write("users", rows);

  assert.equal(db.runs.length, 3);
  assert.ok(db.runs.every((statement) => statement.sql.startsWith('INSERT INTO "users" ("coins", "name", "source_id")')));
  assert.ok(db.runs.every((statement) => statement.sql.endsWith(
    'ON CONFLICT ("source_id") DO UPDATE SET "coins" = excluded."coins", "name" = excluded."name"'
  )));
  assert.deepEqual(db.runs.map((statement) => statement.values.length / 3), [33, 33, 4]);
  assert.equal(db.runs[0].values.length, 99);
});

test("D1 writer rejects unsafe identifiers, uneven rows and non-finite numbers", async () => {
  const db = new FakeD1();
  const writer = new D1TargetWriter(db);
  await assert.rejects(() => writer.write("users; DROP TABLE users", [{ a: 1 }]), /Unsafe SQL identifier/);
  await assert.rejects(
    () => writer.write("users", [{ a: 1 }, { b: 2 }]),
    /identical columns/
  );
  await assert.rejects(() => writer.write("users", [{ a: Number.NaN }]), /non-finite numbers/);
  assert.equal(db.runs.length, 0);
});

test("D1 writeBatch submits all chunks in one atomic batch", async () => {
  const db = new FakeD1();
  await new D1TargetWriter(db).writeBatch([
    { table: "users", rows: [{ source_id: "a", coins: 1 }, { source_id: "b", coins: 2 }] },
    { table: "wallet_transactions", rows: [{ source_id: "c", amount: 5 }] }
  ]);
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 2);
  assert.match(db.batches[0][0].sql, /INSERT INTO "users"/);
  assert.match(db.batches[0][1].sql, /INSERT INTO "wallet_transactions"/);
  await new D1TargetWriter(db).write("users", []);
  assert.equal(db.runs.length, 0);
});

function fakeModel(ids: string[]) {
  const filters: Record<string, unknown>[] = [];
  const limits: number[] = [];
  const sorts: Record<string, 1 | -1>[] = [];
  const model: MongoModelLike = {
    countDocuments: async () => ids.length,
    find(filter: Record<string, unknown>) {
      filters.push(filter);
      return {
        sort(spec: Record<string, 1 | -1>) {
          sorts.push(spec);
          return {
            limit(limit: number) {
              limits.push(limit);
              return {
                lean: async (): Promise<SourceRecord[]> => {
                  const after = (filter._id as { $gt?: unknown } | undefined)?.$gt;
                  const start = after === undefined ? 0 : ids.findIndex((id) => String(id) === String(after)) + 1;
                  return ids.slice(start, start + limit).map((id) => ({ _id: id }));
                }
              };
            }
          };
        }
      };
    }
  };
  return { model, filters, limits, sorts };
}

const IDS = [
  "507f1f77bcf86cd799439011",
  "507f1f77bcf86cd799439012",
  "507f1f77bcf86cd799439013"
];

test("MongoDB reader uses keyset pagination with ObjectId cursors", async () => {
  const { model, filters, limits, sorts } = fakeModel(IDS);
  const reader = new MongoCollectionReader("users", model);
  assert.equal(await reader.count(), 3);
  assert.deepEqual(await reader.readBatch(undefined, 2), [{ _id: IDS[0] }, { _id: IDS[1] }]);
  assert.deepEqual(await reader.readBatch(IDS[1], 2), [{ _id: IDS[2] }]);
  assert.deepEqual(filters[0], {});
  assert.equal(String((filters[1]._id as { $gt: Types.ObjectId }).$gt), IDS[1]);
  assert.deepEqual(sorts, [{ _id: 1 }, { _id: 1 }]);
  assert.deepEqual(limits, [2, 2]);
  await assert.rejects(() => reader.readBatch("bad", 2), /invalid ObjectId cursor/);
  await assert.rejects(() => reader.readBatch(undefined, 0), /limit must be/);
});

test("MongoDB reader keeps canonical string _id values as strings", async () => {
  const { model, filters } = fakeModel(["media-1", "media-2"]);
  const reader = new MongoCollectionReader("media_objects", model, { stringIds: true });
  await reader.readBatch("media-1", 1);
  assert.deepEqual(filters, [{ _id: { $gt: "media-1" } }]);
});
