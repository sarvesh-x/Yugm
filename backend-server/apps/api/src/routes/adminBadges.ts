import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { badgeId, definitionSchema } from "../modules/admin/badgeDefinition.js";
import { requireAdminAuth, requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { Achievement, badgeIcons, badgeMetrics, badgeTiers, honorMetrics } from "../models/Achievement.js";
import { adminOk } from "../modules/admin/http.js";
import { auditLog } from "../services/adminAudit.js";
import { getAsset, type PublicAsset } from "../services/assets.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const adminBadgesRouter = Router();
export const badgeArtRouter = Router();
// Explicit auth keeps these routes safe regardless of Express mount order.
// badgeArtRouter is intentionally public asset delivery and is not guarded.
adminBadgesRouter.use(requireAdminAuth);
adminBadgesRouter.use("/badges", requirePermission("cosmetics.write"));

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024, files: 1, fields: 1 } });

/** Pure validation shared by create/update and unit tests. */
export function assertBadgeAssetTarget(
  asset: Pick<PublicAsset, "ownerType" | "ownerId" | "status" | "publicUrl" | "variants">,
  badgeId: string
) {
  if (asset.ownerType !== "badge" || asset.ownerId !== badgeId) {
    throw new HttpError(400, "Asset does not belong to this badge");
  }
  if (asset.status !== "published" || !(asset.publicUrl || asset.variants.some((variant) => variant.name === "full"))) {
    throw new HttpError(400, "Asset is not published and cannot be used by a badge");
  }
}

/** A badge may only reference a published asset owned by that same badge id. */
async function assertBadgeAssetRef(assetRef: string, badgeId: string) {
  assertBadgeAssetTarget(await getAsset(assetRef), badgeId);
}

function parseDefinition(req: AdminAuthRequest) {
  let body: unknown = req.body;
  if (typeof req.body?.definition === "string") {
    try { body = JSON.parse(req.body.definition); }
    catch { throw new HttpError(400, "Invalid badge definition"); }
  }
  const parsed = definitionSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map(issue => issue.message).join(" "));
  return parsed.data;
}

function badgeImage(file: Express.Multer.File | undefined, id: string) {
  if (!file) return undefined;
  const bytes = file.buffer;
  const signature = bytes.subarray(0, 8).toString("hex");
  const mime = signature.startsWith("ffd8ff") ? "image/jpeg"
    : signature === "89504e470d0a1a0a" ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!mime || mime !== file.mimetype) throw new HttpError(400, "Upload a PNG, JPEG, or WebP image.");
  return { imageData: bytes, imageMime: mime, imageUrl: `/api/badge-art/${id}/${randomUUID()}` };
}

adminBadgesRouter.get("/badges", asyncHandler(async (_req, res) => {
  const definitions = await Achievement.find().sort({ hidden: 1, order: 1, id: 1 }).lean();
  adminOk(res, {
    badges: definitions.map(def => ({ ...def, kind: def.kind ?? "ACHIEVEMENT", metric: def.metric ?? def.id })),
    metrics: badgeMetrics, honorMetrics, icons: badgeIcons, tierNames: badgeTiers
  });
}));

adminBadgesRouter.post("/badges", imageUpload.single("image"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { removeImage: _, ...definition } = parseDefinition(req);
  if (await Achievement.exists({ id: definition.id })) throw new HttpError(409, "This badge ID already exists.");
  if (definition.assetRef) await assertBadgeAssetRef(definition.assetRef, definition.id);
  let entityId: string;
  try { entityId = (await Achievement.create({ ...definition, ...badgeImage(req.file, definition.id) }))._id.toString(); }
  catch (error) {
    if ((error as { code?: number }).code === 11000) throw new HttpError(409, "This badge ID already exists.");
    throw error;
  }
  await auditLog({ adminId: req.admin!.id, action: "badge.created", entityType: "achievement", entityId, metadata: { badgeId: definition.id }, req });
  adminOk(res, { id: definition.id }, {}, 201);
}));

adminBadgesRouter.put("/badges/:id", imageUpload.single("image"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { removeImage, ...definition } = parseDefinition(req);
  // Removing art must clear the managed reference as well as the legacy blob
  // fields; otherwise the public DTO would keep advertising the old asset.
  if (removeImage && definition.assetRef) delete definition.assetRef;
  if (definition.id !== req.params.id) throw new HttpError(400, "Badge IDs cannot be changed.");
  const existing = await Achievement.findOne({ id: definition.id });
  if (!existing) throw new HttpError(404, "Badge not found.");
  if ((existing.kind ?? "ACHIEVEMENT") !== definition.kind) throw new HttpError(400, "Badge types cannot be changed after creation.");
  if (definition.assetRef) await assertBadgeAssetRef(definition.assetRef, definition.id);
  const image = badgeImage(req.file, definition.id);
  await Achievement.updateOne({ id: definition.id }, {
    $set: { ...definition, ...image },
    $unset: {
      ...(definition.kind === "ACHIEVEMENT" ? { weeklyTarget: "" } : {}),
      ...(removeImage && !image ? { imageData: "", imageMime: "", imageUrl: "", assetRef: "" } : {})
    }
  });
  await auditLog({ adminId: req.admin!.id, action: "badge.updated", entityType: "achievement", entityId: existing._id.toString(), metadata: { badgeId: definition.id }, req });
  adminOk(res, { id: definition.id });
}));

adminBadgesRouter.delete("/badges/:id", asyncHandler(async (req: AdminAuthRequest, res) => {
  const id = badgeId.safeParse(req.params.id);
  if (!id.success) throw new HttpError(400, "Invalid badge ID.");
  const archived = await Achievement.findOneAndUpdate({ id: id.data }, { $set: { hidden: true } });
  if (!archived) throw new HttpError(404, "Badge not found.");
  await auditLog({ adminId: req.admin!.id, action: "badge.archived", entityType: "achievement", entityId: archived._id.toString(), metadata: { badgeId: id.data }, req });
  adminOk(res, { archived: true });
}));

adminBadgesRouter.use("/badges", (error: unknown, _req: Request, _res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    next(new HttpError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "Upload one badge image up to 512 KB."));
  } else next(error);
});

badgeArtRouter.get("/:id/:version", asyncHandler(async (req, res) => {
  const image = await Achievement.findOne({
    id: req.params.id,
    imageUrl: `/api/badge-art/${req.params.id}/${req.params.version}`,
    hidden: { $ne: true }
  }).select("imageMime +imageData");
  if (!image?.imageData || !image.imageMime) throw new HttpError(404, "Badge image not found.");
  res.type(image.imageMime).set({
    "Cache-Control": "public, max-age=3600, immutable",
    "Cross-Origin-Resource-Policy": "cross-origin"
  }).send(image.imageData);
}));
