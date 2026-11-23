import path from "path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAdminAuth, requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { auditLog } from "../services/adminAudit.js";
import { assertAssetOwner, assertAssetOwnerId, archiveAsset, createStagingAsset, getAsset, listAssets, publishAsset } from "../services/assets.js";
import { assetOwners, assetStatuses } from "../models/AssetObject.js";
import { assertAssetStagingFileName, loadAssetStagingFile } from "../services/storage.js";

export const adminAssetsRouter = Router();
adminAssetsRouter.use(requireAdminAuth);

const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ASSET_BYTES, files: 1, fields: 8 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype.toLowerCase())) {
      return cb(new HttpError(400, "Only JPEG, PNG, WebP and GIF assets are allowed"));
    }
    cb(null, true);
  }
});

const assetQuerySchema = z.object({
  ownerType: z.enum(assetOwners).optional(),
  ownerId: z.string().trim().min(1).max(64).optional(),
  status: z.enum(assetStatuses).optional()
});

function stagingContentType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

adminAssetsRouter.get("/assets", requirePermission("cosmetics.read"),
  asyncHandler(async (req: AdminAuthRequest, res: Response) => {
    const parsed = assetQuerySchema.parse(req.query);
    if (parsed.ownerId) assertAssetOwnerId(parsed.ownerId);
    const { page, limit, skip } = pageParams(req.query as Record<string, unknown>);
    const result = await listAssets(parsed, skip, limit);
    adminOk(res, { assets: result.items }, paginationMeta(page, limit, result.total));
  })
);

// Registered before /assets/:id so a staging filename is never read as an ID.
adminAssetsRouter.get("/assets/staging/:fileName", requirePermission("cosmetics.read"),
  asyncHandler(async (req: Request, res: Response) => {
    const fileName = assertAssetStagingFileName(req.params.fileName);
    const staged = await loadAssetStagingFile(fileName);
    res.type(stagingContentType(fileName)).set("Cache-Control", "private, no-store");
    if ("body" in staged) return void res.send(staged.body);
    return void res.sendFile(staged.filePath);
  })
);

adminAssetsRouter.get("/assets/:id", requirePermission("cosmetics.read"),
  asyncHandler(async (req: Request, res: Response) => {
    adminOk(res, { asset: await getAsset(req.params.id) });
  })
);

adminAssetsRouter.post("/assets", requirePermission("cosmetics.write"), assetUpload.single("asset"),
  asyncHandler(async (req: AdminAuthRequest, res: Response) => {
    const parsed = z.object({
      ownerType: z.string().trim().min(1),
      ownerId: z.string().trim().min(1),
      originalName: z.string().trim().max(200).optional()
    }).parse(req.body);
    const ownerType = assertAssetOwner(parsed.ownerType);
    const ownerId = assertAssetOwnerId(parsed.ownerId);
    if (!req.file) throw new HttpError(400, "An asset file is required");

    const asset = await createStagingAsset({
      ownerType,
      ownerId,
      originalName: parsed.originalName ?? req.file.originalname,
      mimeType: req.file.mimetype,
      bytes: req.file.size,
      content: req.file.buffer,
      adminId: req.admin!.id
    });
    await auditLog({
      adminId: req.admin!.id,
      action: "asset.staged",
      entityType: "AssetObject",
      entityId: asset.id,
      metadata: { ownerType, ownerId, version: asset.version, sha256: asset.sha256 },
      req
    });
    adminOk(res, { asset }, {}, 201);
  })
);

adminAssetsRouter.post("/assets/:id/publish", requirePermission("cosmetics.write"),
  asyncHandler(async (req: AdminAuthRequest, res: Response) => {
    const existing = await getAsset(req.params.id);
    const asset = await publishAsset(req.params.id);
    await auditLog({
      adminId: req.admin!.id,
      action: "asset.published",
      entityType: "AssetObject",
      entityId: asset.id,
      metadata: { ownerType: existing.ownerType, ownerId: existing.ownerId, version: asset.version, publicUrl: asset.publicUrl },
      req
    });
    adminOk(res, { asset });
  })
);

adminAssetsRouter.delete("/assets/:id", requirePermission("cosmetics.write"),
  asyncHandler(async (req: AdminAuthRequest, res: Response) => {
    const existing = await getAsset(req.params.id);
    const asset = await archiveAsset(req.params.id);
    await auditLog({
      adminId: req.admin!.id,
      action: "asset.archived",
      entityType: "AssetObject",
      entityId: asset.id,
      metadata: { ownerType: existing.ownerType, ownerId: existing.ownerId, version: asset.version },
      req
    });
    adminOk(res, { asset });
  })
);

adminAssetsRouter.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    next(new HttpError(status, "Upload one image up to 8 MB."));
    return;
  }
  next(error);
});
