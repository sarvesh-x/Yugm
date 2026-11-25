import type { D1Database } from "@cloudflare/workers-types";
import { ErrorCode, HttpError } from "../utils/http.js";

const publishedArt = `(length(a.public_url) > 0 OR EXISTS (
  SELECT 1 FROM asset_variants v WHERE v.assets_id = a.source_id AND v.name = 'full' AND v.key <> a.staging_key))`;

// All expressions come from trusted SQL in the callers. Request values are bound as parameters.
export function publishedAssetReference(reference: string, ownerType: "cosmetic" | "badge", ownerId: string) {
  return `(${reference} IS NULL OR ${reference} = '' OR EXISTS (SELECT 1 FROM assets a WHERE a.source_id = ${reference}
    AND a.owner_type = '${ownerType}' AND a.owner_id = ${ownerId} AND a.status = 'published' AND ${publishedArt}))`;
}

export async function assertPublishedAssetReference(db: D1Database, reference: string | undefined, ownerType: "cosmetic" | "badge", ownerId: string) {
  if (!reference) return;
  const asset = await db.prepare(`SELECT a.owner_type, a.owner_id,
    a.status = 'published' AND ${publishedArt} AS valid FROM assets a WHERE a.source_id = ?`)
    .bind(reference).first<{ owner_type: string; owner_id: string; valid: number | null }>();
  if (!asset) throw new HttpError(404, "Asset not found", ErrorCode.NOT_FOUND);
  if (asset.owner_type !== ownerType || asset.owner_id !== ownerId) {
    throw new HttpError(400, `Asset does not belong to this ${ownerType}`, ErrorCode.VALIDATION);
  }
  if (!asset.valid) throw new HttpError(400, `Asset is not published and cannot be used by a ${ownerType}`, ErrorCode.VALIDATION);
}
