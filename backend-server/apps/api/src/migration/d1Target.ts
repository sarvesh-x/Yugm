/**
 * Minimal D1-compatible batch writer. Any object exposing `prepare(...).bind(...).run()`
 * and `batch(...)` satisfies D1Like, so this can be tested without a real binding.
 * Never connects to Cloudflare on its own.
 */
import type { TargetRow, TargetWriter } from "./types.js";

export interface D1BoundStatement {
  run(): Promise<unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1BoundStatement;
}

export interface D1Like {
  prepare(query: string): D1PreparedStatement;
  batch(statements: readonly D1BoundStatement[]): Promise<unknown[]>;
}

/** D1 allows at most 100 bound parameters per statement. */
export const D1_MAX_BOUND_PARAMETERS = 100;

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(value: string): string {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

function normalizeValue(value: string | number | null | undefined): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("non-finite numbers cannot be written to D1");
  }
  return value;
}

export class D1TargetWriter implements TargetWriter {
  constructor(private readonly db: D1Like) {}

  private *prepareUpserts(table: string, rows: readonly TargetRow[]): Iterable<D1BoundStatement> {
    if (!rows.length) return;
    const tableSql = quoteIdentifier(table);
    const columns = Object.keys(rows[0]).sort();
    if (!columns.length) throw new Error(`${table}: row has no columns`);
    for (let index = 1; index < rows.length; index += 1) {
      const other = Object.keys(rows[index]);
      if (other.length !== columns.length || other.some((column) => !columns.includes(column))) {
        throw new Error(`${table}: batch rows must have identical columns`);
      }
    }
    const columnSql = columns.map(quoteIdentifier).join(", ");
    const updates = columns.filter((column) => column !== "source_id").map((column) => {
      const quoted = quoteIdentifier(column);
      return `${quoted} = excluded.${quoted}`;
    });
    // Only an existing row with the same source identity is eligible for replacement.
    const onConflict = updates.length ? `DO UPDATE SET ${updates.join(", ")}` : "DO NOTHING";
    const rowsPerStatement = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMETERS / columns.length));

    for (let offset = 0; offset < rows.length; offset += rowsPerStatement) {
      const chunk = rows.slice(offset, offset + rowsPerStatement);
      const placeholders = chunk.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
      const values: unknown[] = [];
      for (const row of chunk) {
        for (const column of columns) values.push(normalizeValue(row[column]));
      }
      const sql = `INSERT INTO ${tableSql} (${columnSql}) VALUES ${placeholders} ON CONFLICT ("source_id") ${onConflict}`;
      yield this.db.prepare(sql).bind(...values);
    }
  }

  async write(table: string, rows: readonly TargetRow[]): Promise<void> {
    for (const statement of this.prepareUpserts(table, rows)) await statement.run();
  }

  /** Applies statements atomically when the binding supports batch(). */
  async writeBatch(writes: ReadonlyArray<{ table: string; rows: readonly TargetRow[] }>): Promise<void> {
    const statements = writes.flatMap(({ table, rows }) => [...this.prepareUpserts(table, rows)]);
    if (statements.length) await this.db.batch(statements);
  }
}
