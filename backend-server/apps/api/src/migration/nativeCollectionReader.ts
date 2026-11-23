/**
 * Read-only keyset-paginated reader over a native MongoDB collection.
 *
 * The collection is injected; this module never opens a connection and never
 * writes. Used by the snapshot export CLI with an already-connected Mongoose
 * connection. ObjectId and canonical string _id collections are both supported.
 */
import { Types } from "mongoose";
import type { SourceCollectionReader, SourceRecord } from "./types.js";

export interface NativeCollectionLike {
  countDocuments(filter: Record<string, unknown>): Promise<number>;
  find(filter: Record<string, unknown>): {
    sort(spec: Record<string, 1 | -1>): {
      limit(count: number): { toArray(): Promise<SourceRecord[]> };
    };
  };
}

export class NativeCollectionReader implements SourceCollectionReader {
  constructor(
    readonly name: string,
    private readonly collection: NativeCollectionLike,
    private readonly options: { stringIds?: boolean } = {}
  ) {}

  async count(): Promise<number> {
    return this.collection.countDocuments({});
  }

  async readBatch(afterId: string | undefined, limit: number): Promise<SourceRecord[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");
    const cursor = afterId === undefined
      ? undefined
      : this.options.stringIds
        ? afterId
        : new Types.ObjectId(afterId);
    const filter = cursor === undefined ? {} : { _id: { $gt: cursor } };
    return this.collection.find(filter).sort({ _id: 1 }).limit(limit).toArray();
  }
}
