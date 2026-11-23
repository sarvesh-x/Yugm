/**
 * Read-only admin projections for the DCR-4 media registry and quota tooling.
 *
 * These helpers never sign URLs or expose object contents. Runtime callers use
 * MongoDB models; tests can exercise the pure query/DTO helpers directly.
 */
import { createHash } from "node:crypto";
import { MediaObject, mediaVisibilities, processingStatuses } from "../models/MediaObject.js";
import { MediaQuotaReservation } from "../models/MediaQuotaReservation.js";
import { MediaUploadSession, uploadSessionStatuses } from "../models/MediaUploadSession.js";
import { mediaCategories } from "./r2.js";

export interface MediaListFilter {
  ownerType?: string;
  ownerId?: string;
  category?: string;
  visibility?: string;
  status?: string;
  deleted?: boolean;
}

export interface MediaSessionFilter {
  userId?: string;
  status?: string;
  category?: string;
}

export interface AdminMediaDto {
  id: string;
  ownerType: string;
  ownerId: string;
  mediaType: string;
  category: string;
  bucket: string;
  storageKey: string;
  checksum: string;
  bytes: number;
  visibility: string;
  processingStatus: string;
  moderationStatus: string;
  version: number;
  variantCount: number;
  deletedAt: string | null;
  createdAt: string | null;
}

export interface AdminMediaSessionDto {
  id: string;
  userId: string;
  category: string;
  status: string;
  expectedBytes: number;
  ownerType: string;
  ownerId: string;
  expiresAt: string | null;
  quotaReserved: boolean;
}

export interface AdminMediaQuotaDto {
  userId: string;
  bytes: number;
  updatedAt: string | null;
}

function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
}

function bounded(value: unknown, max = 128): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

export function buildMediaQuery(filter: MediaListFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  const ownerType = bounded(filter.ownerType, 64);
  const ownerId = bounded(filter.ownerId, 128);
  const category = bounded(filter.category, 64);
  const visibility = bounded(filter.visibility, 32);
  const status = bounded(filter.status, 32);
  if (ownerType) query.ownerType = ownerType;
  if (ownerId) query.ownerId = ownerId;
  if (category && mediaCategories.includes(category as (typeof mediaCategories)[number])) query.category = category;
  if (visibility && mediaVisibilities.includes(visibility as (typeof mediaVisibilities)[number])) query.visibility = visibility;
  if (status && processingStatuses.includes(status as (typeof processingStatuses)[number])) query.processingStatus = status;
  if (typeof filter.deleted === "boolean") query.deletedAt = filter.deleted ? { $exists: true, $ne: null } : null;
  return query;
}

export function buildSessionQuery(filter: MediaSessionFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  const userId = bounded(filter.userId, 128);
  const category = bounded(filter.category, 64);
  const status = bounded(filter.status, 32);
  if (userId) query.userId = userId;
  if (category && mediaCategories.includes(category as (typeof mediaCategories)[number])) query.category = category;
  if (status && uploadSessionStatuses.includes(status as (typeof uploadSessionStatuses)[number])) query.status = status;
  return query;
}

export function toAdminMediaDto(record: Record<string, unknown>): AdminMediaDto {
  return {
    id: String(record._id ?? ""),
    ownerType: String(record.ownerType ?? ""),
    ownerId: String(record.ownerId ?? ""),
    mediaType: String(record.mediaType ?? ""),
    category: String(record.category ?? ""),
    bucket: String(record.bucket ?? ""),
    storageKey: String(record.storageKey ?? ""),
    checksum: String(record.checksum ?? ""),
    bytes: typeof record.fileSize === "number" ? record.fileSize : 0,
    visibility: String(record.visibility ?? ""),
    processingStatus: String(record.processingStatus ?? ""),
    moderationStatus: String(record.moderationStatus ?? ""),
    version: typeof record.version === "number" ? record.version : 0,
    variantCount: Array.isArray(record.variants) ? record.variants.length : 0,
    deletedAt: iso(record.deletedAt),
    createdAt: iso(record.createdAt),
  };
}

export function toAdminSessionDto(record: Record<string, unknown>): AdminMediaSessionDto {
  return {
    id: String(record._id ?? ""),
    userId: String(record.userId ?? ""),
    category: String(record.category ?? ""),
    status: String(record.status ?? ""),
    expectedBytes: typeof record.expectedBytes === "number" ? record.expectedBytes : 0,
    ownerType: String(record.ownerType ?? ""),
    ownerId: String(record.ownerId ?? ""),
    expiresAt: iso(record.expiresAt),
    quotaReserved: record.quotaReserved !== false,
  };
}

export function toAdminQuotaDto(record: Record<string, unknown>): AdminMediaQuotaDto {
  return {
    userId: String(record._id ?? ""),
    bytes: typeof record.bytes === "number" ? record.bytes : 0,
    updatedAt: iso(record.updatedAt),
  };
}

export async function listAdminMedia(filter: MediaListFilter, skip: number, limit: number) {
  const query = buildMediaQuery(filter);
  const [items, total] = await Promise.all([
    MediaObject.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MediaObject.countDocuments(query),
  ]);
  return { items: items.map((item) => toAdminMediaDto(item as Record<string, unknown>)), total };
}

export async function listAdminSessions(filter: MediaSessionFilter, skip: number, limit: number) {
  const query = buildSessionQuery(filter);
  const [items, total] = await Promise.all([
    MediaUploadSession.find(query).sort({ expiresAt: 1 }).skip(skip).limit(limit).lean(),
    MediaUploadSession.countDocuments(query),
  ]);
  return { items: items.map((item) => toAdminSessionDto(item as Record<string, unknown>)), total };
}

export async function listAdminQuotas(skip: number, limit: number) {
  const [items, total] = await Promise.all([
    MediaQuotaReservation.find({}).sort({ bytes: -1 }).skip(skip).limit(limit).lean(),
    MediaQuotaReservation.countDocuments({}),
  ]);
  return { items: items.map((item) => toAdminQuotaDto(item as Record<string, unknown>)), total };
}

export type QuotaReconciliationStatus = "OK" | "OVER_RESERVED" | "UNDER_RESERVED" | "MISSING_COUNTER";

export interface QuotaReconciliationRow {
  userId: string;
  counterBytes: number;
  expectedBytes: number;
  deltaBytes: number;
  status: QuotaReconciliationStatus;
}

export interface QuotaReconciliationReport {
  generatedAt: string;
  counterCount: number;
  driftCount: number;
  staleSessions: number;
  rows: QuotaReconciliationRow[];
  digest: string;
}

export function buildQuotaReconciliation(
  counters: ReadonlyArray<{ userId: string; bytes: number }>,
  expected: ReadonlyArray<{ userId: string; bytes: number }>,
  staleSessions: number,
  generatedAt = new Date().toISOString()
): QuotaReconciliationReport {
  const counterMap = new Map(counters.map((row) => [row.userId, row.bytes]));
  const expectedMap = new Map(expected.map((row) => [row.userId, row.bytes]));
  const userIds = [...new Set([...counterMap.keys(), ...expectedMap.keys()])].sort();

  const rows: QuotaReconciliationRow[] = userIds.map((userId) => {
    const counterBytes = counterMap.get(userId) ?? 0;
    const expectedBytes = expectedMap.get(userId) ?? 0;
    const deltaBytes = counterBytes - expectedBytes;
    const status: QuotaReconciliationStatus = !counterMap.has(userId)
      ? "MISSING_COUNTER"
      : deltaBytes > 0
        ? "OVER_RESERVED"
        : deltaBytes < 0
          ? "UNDER_RESERVED"
          : "OK";
    return { userId, counterBytes, expectedBytes, deltaBytes, status };
  }).sort((a, b) => Math.abs(b.deltaBytes) - Math.abs(a.deltaBytes) || a.userId.localeCompare(b.userId));

  const digestInput = rows.map((row) => `${row.userId}:${row.counterBytes}:${row.expectedBytes}:${row.status}`).join("\n");
  return {
    generatedAt,
    counterCount: counterMap.size,
    driftCount: rows.filter((row) => row.status !== "OK").length,
    staleSessions,
    rows,
    digest: createHash("sha256").update(`${staleSessions}\n${digestInput}\n`).digest("hex"),
  };
}

export async function reconcileMediaQuotas(now = new Date()): Promise<QuotaReconciliationReport> {
  const [counterDocs, expectedRows, staleSessions] = await Promise.all([
    MediaQuotaReservation.find({}).select("_id bytes").lean(),
    MediaUploadSession.aggregate<{ _id: string; total: number }>([
      { $match: { quotaReserved: true, status: { $in: ["PENDING", "PROCESSING"] }, expiresAt: { $gt: now } } },
      { $group: { _id: "$userId", total: { $sum: "$expectedBytes" } } },
    ]),
    MediaUploadSession.countDocuments({
      quotaReserved: true,
      $or: [{ status: { $nin: ["PENDING", "PROCESSING"] } }, { expiresAt: { $lte: now } }],
    }),
  ]);

  return buildQuotaReconciliation(
    counterDocs.map((doc) => ({ userId: String(doc._id), bytes: typeof doc.bytes === "number" ? doc.bytes : 0 })),
    expectedRows.map((row) => ({ userId: String(row._id), bytes: row.total ?? 0 })),
    staleSessions
  );
}
