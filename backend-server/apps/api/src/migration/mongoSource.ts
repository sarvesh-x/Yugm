/**
 * Read-only MongoDB collection adapter for the export stage.
 * A Mongoose model is injected; this module never opens a connection.
 */
import { Types } from "mongoose";
import type { SourceCollectionReader, SourceRecord } from "./types.js";

interface LeanQuery {
  lean(): Promise<SourceRecord[]>;
}

interface LimitedQuery {
  limit(limit: number): LeanQuery;
}

interface SortedQuery {
  sort(spec: Record<string, 1 | -1>): LimitedQuery;
}

export interface MongoModelLike {
  countDocuments(): Promise<number>;
  find(filter: Record<string, unknown>): SortedQuery;
}

export interface MongoReaderOptions {
  /** Set true when _id is a canonical string (for example MediaObject) rather than ObjectId. */
  stringIds?: boolean;
}

function cursorValue(id: string, stringIds: boolean): string | Types.ObjectId {
  if (stringIds) return id;
  if (!Types.ObjectId.isValid(id)) throw new Error(`invalid ObjectId cursor: ${id}`);
  return new Types.ObjectId(id);
}

export class MongoCollectionReader implements SourceCollectionReader {
  constructor(
    readonly name: string,
    private readonly model: MongoModelLike,
    private readonly options: MongoReaderOptions = {}
  ) {}

  async count(): Promise<number> {
    return this.model.countDocuments();
  }

  async readBatch(afterId: string | undefined, limit: number): Promise<SourceRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
      throw new Error("limit must be an integer between 1 and 5000");
    }
    const filter = afterId
      ? { _id: { $gt: cursorValue(afterId, Boolean(this.options.stringIds)) } }
      : {};
    return this.model.find(filter).sort({ _id: 1 }).limit(limit).lean();
  }
}
