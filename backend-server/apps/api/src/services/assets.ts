import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "fs/promises";
import mongoose from "mongoose";
import sharp from "sharp";
import {
  AssetObject,
  assetOwners,
  type AssetDocument,
  type AssetOwner,
  type AssetVariant
} from "../models/AssetObject.js";
import { Cosmetic } from "../models/Cosmetic.js";
import { Achievement } from "../models/Achievement.js";
import {
  deleteStoredFile,
  loadAssetStagingFile,
  persistManagedBuffer
} from "./storage.js";
import { HttpError } from "../utils/http.js";

const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_ASSET_DIMENSION = 8192;

const allowedAssetExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export interface AssetInput {
  ownerType: AssetOwner;
  ownerId: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  content: Buffer;
  adminId: string;
}

export interface PublicAsset {
  id: string;
  ownerType: AssetOwner;
  ownerId: string;
  status: AssetDocument["status"];
  version: number;
  originalName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  publicKey?: string;
  publicUrl?: string;
  variants: AssetVariant[];
  createdBy: string;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function assertAssetOwner(ownerType: string): AssetOwner {
  if (!assetOwners.includes(ownerType as AssetOwner)) {
    throw new HttpError(400, "Unsupported asset owner type");
  }
  return ownerType as AssetOwner;
}

export function assertAssetOwnerId(ownerId: string) {
  const trimmed = ownerId.trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    throw new HttpError(400, "Invalid asset owner ID");
  }
  return trimmed;
}

export function assetExtensionFor(mimeType: string) {
  const ext = allowedAssetExtensions[mimeType.toLowerCase()];
  if (!ext) throw new HttpError(400, "Only JPEG, PNG, WebP and GIF assets are supported");
  return ext;
}

export function assertAssetSize(bytes: number) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_ASSET_BYTES) {
    throw new HttpError(413, `Asset must be between 1 byte and ${MAX_ASSET_BYTES} bytes`);
  }
  return bytes;
}

export function assetStagingFileName(ownerType: AssetOwner, ownerId: string, version: number, ext: string, nonce: string) {
  const owner = `${ownerType}_${ownerId}`.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `${owner}_v${version}_${nonce}.${ext}`;
}

export function assetPublicKey(ownerType: AssetOwner, ownerId: string, version: number, variant: string) {
  const owner = `${ownerType}_${ownerId}`.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `assets/${owner}_v${version}_${variant}.webp`;
}

export function toPublicAsset(asset: AssetDocument): PublicAsset {
  return {
    id: String(asset._id),
    ownerType: asset.ownerType,
    ownerId: asset.ownerId,
    status: asset.status,
    version: asset.version,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    sha256: asset.sha256,
    ...(asset.publicKey ? { publicKey: asset.publicKey } : {}),
    ...(asset.publicUrl ? { publicUrl: asset.publicUrl } : {}),
    variants: asset.variants.map((variant) => ({ ...variant })),
    createdBy: asset.createdBy,
    ...(asset.publishedAt ? { publishedAt: asset.publishedAt } : {}),
    ...(asset.archivedAt ? { archivedAt: asset.archivedAt } : {}),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt
  };
}

async function nextAssetVersion(ownerType: AssetOwner, ownerId: string) {
  const db = mongoose.connection.db;
  if (!db) throw new HttpError(503, "Asset storage is unavailable");
  const result = await db.collection<{ _id: string; seq: number }>("asset.counters").findOneAndUpdate(
    { _id: `${ownerType}:${ownerId}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) throw new HttpError(503, "Asset version could not be allocated");
  return result.seq;
}

async function readStagingContent(asset: AssetDocument): Promise<Buffer> {
  const fileName = asset.stagingKey.slice("assets-staging/".length);
  const staged = await loadAssetStagingFile(fileName);
  if ("body" in staged && staged.body) return staged.body;
  return fs.readFile(staged.filePath);
}

/** Upload bytes to private staging. No public URL is produced until publish. */
export async function createStagingAsset(input: AssetInput): Promise<PublicAsset> {
  const ownerType = assertAssetOwner(input.ownerType);
  const ownerId = assertAssetOwnerId(input.ownerId);
  const ext = assetExtensionFor(input.mimeType);
  assertAssetSize(input.bytes);
  if (input.content.length !== input.bytes) throw new HttpError(400, "Asset size does not match the uploaded file");

  const metadata = await sharp(input.content, { animated: true }).metadata().catch(() => null);
  if (!metadata) throw new HttpError(400, "Uploaded file is not a supported image");
  if (!metadata.width || !metadata.height || metadata.width > MAX_ASSET_DIMENSION || metadata.height > MAX_ASSET_DIMENSION) {
    throw new HttpError(400, "Asset dimensions are outside the supported range");
  }

  const sha256 = createHash("sha256").update(input.content).digest("hex");
  const duplicate = await AssetObject.findOne({ ownerType, ownerId, sha256, status: { $ne: "archived" } }).lean();
  if (duplicate) return toPublicAsset(duplicate as unknown as AssetDocument);

  const version = await nextAssetVersion(ownerType, ownerId);
  const nonce = randomBytes(4).toString("hex");
  const fileName = assetStagingFileName(ownerType, ownerId, version, ext, nonce);
  const staged = await persistManagedBuffer({
    buffer: input.content,
    key: `assets-staging/${fileName}`,
    contentType: input.mimeType,
    isPrivate: true
  });

  const asset = await AssetObject.create({
    _id: randomUUID(),
    ownerType,
    ownerId,
    kind: "IMAGE",
    status: "staging",
    version,
    originalName: input.originalName.slice(0, 200),
    mimeType: input.mimeType,
    bytes: input.bytes,
    width: metadata.width,
    height: metadata.height,
    sha256,
    stagingKey: staged.key,
    stagingUrl: staged.url,
    variants: [],
    createdBy: input.adminId
  });
  return toPublicAsset(asset);
}

async function buildVariants(asset: AssetDocument, content: Buffer): Promise<AssetVariant[]> {
  const definitions = [
    { name: "full", width: 1600 },
    { name: "preview", width: 512 }
  ];
  const variants: AssetVariant[] = [];
  for (const definition of definitions) {
    const output = await sharp(content, { animated: true })
      .rotate()
      .resize({ width: definition.width, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    const key = assetPublicKey(asset.ownerType, asset.ownerId, asset.version, definition.name);
    const stored = await persistManagedBuffer({
      buffer: output.data,
      key,
      contentType: "image/webp",
      isPrivate: false
    });
    variants.push({
      name: definition.name,
      key: stored.key,
      url: stored.url,
      contentType: "image/webp",
      bytes: output.data.length,
      width: output.info.width,
      height: output.info.height
    });
  }
  return variants;
}

/**
 * Publish a staged asset. Each version owns immutable object keys, so
 * republishing or replacing art never overwrites a URL clients may have cached.
 */
export async function publishAsset(assetId: string): Promise<PublicAsset> {
  const asset = await AssetObject.findById(assetId);
  if (!asset) throw new HttpError(404, "Asset not found");
  if (asset.status === "archived") throw new HttpError(409, "Archived assets cannot be published");
  if (asset.status === "published") return toPublicAsset(asset);

  const content = await readStagingContent(asset);
  const variants = await buildVariants(asset, content);
  const full = variants.find((variant) => variant.name === "full");
  if (!full) throw new HttpError(500, "Asset variants were not produced");

  asset.variants = variants;
  asset.publicKey = full.key;
  asset.publicUrl = full.url;
  asset.status = "published";
  asset.publishedAt = new Date();
  await asset.save();
  return toPublicAsset(asset);
}

/** Reject archive while a catalogue document still advertises this asset. */
export function assertNoPublishedReferences(referenceCount: number) {
  if (referenceCount > 0) {
    throw new HttpError(409, "Asset is still referenced by a catalog item; clear the reference first");
  }
}

/** Archive an asset and remove its objects. Published references must be cleared first. */
export async function archiveAsset(assetId: string): Promise<PublicAsset> {
  const asset = await AssetObject.findById(assetId);
  if (!asset) throw new HttpError(404, "Asset not found");
  if (asset.status === "archived") return toPublicAsset(asset);
  const [cosmeticRefs, badgeRefs] = await Promise.all([
    Cosmetic.countDocuments({ assetRef: assetId }),
    Achievement.countDocuments({ assetRef: assetId })
  ]);
  assertNoPublishedReferences(cosmeticRefs + badgeRefs);

  // Clear the published reference first. If object deletion fails afterwards,
  // the registry no longer advertises a URL whose object may be gone.
  const publishedVariants = asset.variants.map((variant) => variant.key);
  const stagingKey = asset.stagingKey;
  asset.status = "archived";
  asset.archivedAt = new Date();
  asset.variants = [];
  asset.publicKey = undefined;
  asset.publicUrl = undefined;
  await asset.save();
  for (const key of publishedVariants) await deleteStoredFile("assets", key);
  await deleteStoredFile("assets-staging", stagingKey);
  return toPublicAsset(asset);
}

export async function getAsset(assetId: string): Promise<PublicAsset> {
  const asset = await AssetObject.findById(assetId).lean();
  if (!asset) throw new HttpError(404, "Asset not found");
  return toPublicAsset(asset as unknown as AssetDocument);
}

/** Resolve the published URL for a cosmetic/badge/gift reference, if any. */
export async function resolvePublishedAsset(ownerType: AssetOwner, ownerId: string): Promise<PublicAsset | undefined> {
  const asset = await AssetObject.findOne({ ownerType, ownerId, status: "published" })
    .sort({ version: -1 })
    .lean();
  return asset ? toPublicAsset(asset as unknown as AssetDocument) : undefined;
}

/**
 * Batch-resolve published assets by id so catalogue reads do not issue one
 * query per cosmetic. Only published assets are returned; a staging or
 * archived reference falls back to the legacy cosmetic field.
 */
export async function findPublishedAssetsByIds(ids: string[]): Promise<Map<string, PublicAsset>> {
  const uniqueIds = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(0, 500);
  if (uniqueIds.length === 0) return new Map();
  const assets = await AssetObject.find({ _id: { $in: uniqueIds }, status: "published" }).lean();
  return new Map(assets.map((asset) => [String(asset._id), toPublicAsset(asset as unknown as AssetDocument)]));
}

export async function listAssets(filter: { ownerType?: AssetOwner; ownerId?: string; status?: AssetDocument["status"] }, skip: number, limit: number) {
  const query: Record<string, unknown> = {};
  if (filter.ownerType) query.ownerType = filter.ownerType;
  if (filter.ownerId) query.ownerId = filter.ownerId;
  if (filter.status) query.status = filter.status;
  const [items, total] = await Promise.all([
    AssetObject.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AssetObject.countDocuments(query)
  ]);
  return { items: items.map((item) => toPublicAsset(item as unknown as AssetDocument)), total };
}
