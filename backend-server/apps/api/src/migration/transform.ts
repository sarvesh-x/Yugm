/**
 * Deterministic, testable transform primitives for the MongoDB -> D1 pipeline.
 *
 * Bad values are quarantined with an explicit reason; nothing is coerced or
 * silently discarded. This module has no database, network or credential access.
 */
import type { QuarantineEntry, QuarantineReason, TransformReport } from "./types.js";

export interface TransformField {
  collection: string;
  field: string;
  rowId?: string;
  context: TransformContext;
  /** Child-element failures are reported but do not mark the parent row as rejected. */
  soft?: boolean;
}

const OBJECT_ID = /^[a-f0-9]{24}$/;

export class TransformContext {
  readonly snapshotId: string;
  readonly quarantine: QuarantineEntry[] = [];
  private readonly counts = new Map<string, { source: number; transformed: number; quarantined: number }>();
  /** A rejected row is counted once even when several of its fields fail validation. */
  private readonly quarantinedRows = new Set<string>();

  constructor(snapshotId: string) {
    if (!snapshotId) throw new Error("snapshotId is required");
    this.snapshotId = snapshotId;
  }

  private countsFor(collection: string) {
    let entry = this.counts.get(collection);
    if (!entry) {
      entry = { source: 0, transformed: 0, quarantined: 0 };
      this.counts.set(collection, entry);
    }
    return entry;
  }

  source(collection: string) {
    this.countsFor(collection).source += 1;
  }

  keep(collection: string) {
    this.countsFor(collection).transformed += 1;
  }

  reject(field: TransformField, reason: QuarantineReason, detail: string): undefined {
    const rowKey = `${field.collection}:${field.rowId ?? "<unknown>"}`;
    if (!field.soft && !this.quarantinedRows.has(rowKey)) {
      this.quarantinedRows.add(rowKey);
      this.countsFor(field.collection).quarantined += 1;
    }
    this.quarantine.push({
      collection: field.collection,
      rowId: field.rowId,
      field: field.field,
      reason,
      detail
    });
    return undefined;
  }

  report(): TransformReport {
    return {
      snapshotId: this.snapshotId,
      generatedAt: new Date().toISOString(),
      collections: Object.fromEntries(this.counts),
      quarantine: [...this.quarantine]
    };
  }

  /** Collections where source rows neither transformed nor quarantined (or were double-counted). */
  unaccounted(): string[] {
    const problems: string[] = [];
    for (const [collection, counts] of this.counts) {
      if (counts.source !== counts.transformed + counts.quarantined) {
        problems.push(`${collection}: source=${counts.source} transformed=${counts.transformed} quarantined=${counts.quarantined}`);
      }
    }
    return problems;
  }

  /** Fails the pipeline if any source row is unaccounted for. */
  assertAccountedFor() {
    const problems = this.unaccounted();
    if (problems.length) throw new Error(`Unaccounted records: ${problems.join("; ")}`);
  }
}

export function toSourceId(value: unknown, field: TransformField): string | undefined {
  const candidate = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (!OBJECT_ID.test(candidate)) {
    return field.context.reject(field, "INVALID_ID", "expected a canonical 24-character lowercase ObjectId string");
  }
  const normalized = candidate.toLowerCase();
  if (normalized !== candidate) {
    return field.context.reject(field, "INVALID_ID", "ObjectId must already be lowercase; normalization is not silent");
  }
  return normalized;
}

export function toUtcIso(value: unknown, field: TransformField): string | undefined {
  let date: Date | undefined;
  if (value instanceof Date) date = value;
  else if (typeof value === "number" && Number.isFinite(value)) date = new Date(value);
  else if (typeof value === "string" && value.trim()) date = new Date(value);
  if (!date || Number.isNaN(date.getTime())) {
    return field.context.reject(field, "INVALID_TIMESTAMP", "value is not a parseable timestamp");
  }
  return date.toISOString();
}

export function toIntegerMinorUnits(
  value: unknown,
  field: TransformField,
  options: { allowNegative?: boolean } = {}
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return field.context.reject(field, "NON_INTEGER_MONEY", "money must be a finite integer in minor units");
  }
  if (!Number.isInteger(value)) {
    return field.context.reject(field, "NON_INTEGER_MONEY", "fractional money requires an explicit conversion rule, not rounding");
  }
  if (!Number.isSafeInteger(value)) {
    return field.context.reject(field, "MONEY_OVERFLOW", "money exceeds the safe integer range");
  }
  if (!options.allowNegative && value < 0) {
    return field.context.reject(field, "NEGATIVE_MONEY", "negative value is not allowed for this field");
  }
  return value;
}

export function toEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: TransformField
): T | undefined {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  return field.context.reject(field, "UNKNOWN_ENUM", `value is not one of the preserved enum values: ${allowed.join(", ")}`);
}

export function toRequiredString(value: unknown, field: TransformField): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  return field.context.reject(field, "MISSING_REQUIRED", "expected a non-empty string");
}

/**
 * For models with a canonical non-ObjectId string key (for example MediaObject
 * UUIDs and MediaQuotaReservation user IDs). The value is preserved exactly:
 * no lowercasing, trimming or other silent normalization.
 */
export function toOpaqueId(value: unknown, field: TransformField): string | undefined {
  if (typeof value === "string" && value.trim() && value === value.trim()) return value;
  return field.context.reject(field, "INVALID_ID", "expected a non-empty string identifier without surrounding whitespace");
}

/** Generic integer counter/size field with explicit bounds. */
export function toInteger(
  value: unknown,
  field: TransformField,
  options: { min?: number; max?: number } = {}
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return field.context.reject(field, "NON_INTEGER", "expected a finite integer");
  }
  if (!Number.isSafeInteger(value)) {
    return field.context.reject(field, "MONEY_OVERFLOW", "value exceeds the safe integer range");
  }
  if ((options.min !== undefined && value < options.min) || (options.max !== undefined && value > options.max)) {
    return field.context.reject(field, "OUT_OF_RANGE", `value must be within [${options.min ?? "-∞"}, ${options.max ?? "∞"}]`);
  }
  return value;
}

/**
 * Finite non-integer numeric field (for example a multiplier or ratio).
 * Values are preserved exactly; no rounding or implicit money conversion.
 */
export function toFiniteNumber(
  value: unknown,
  field: TransformField,
  options: { min?: number; max?: number } = {}
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return field.context.reject(field, "NON_FINITE_NUMBER", "expected a finite number; fractional values are preserved");
  }
  if ((options.min !== undefined && value < options.min) || (options.max !== undefined && value > options.max)) {
    return field.context.reject(field, "OUT_OF_RANGE", `value must be within [${options.min ?? "-∞"}, ${options.max ?? "∞"}]`);
  }
  return value;
}

/** Booleans become SQLite integers; other values are quarantined rather than coerced. */
export function toBoolean(value: unknown, field: TransformField): number | undefined {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === 0 || value === 1) return value;
  return field.context.reject(field, "INVALID_BOOLEAN", "expected a boolean or 0/1");
}
