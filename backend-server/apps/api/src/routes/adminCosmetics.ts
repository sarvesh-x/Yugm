import { Router } from "express";
import { createCosmeticSchema, updateCosmeticSchema } from "../modules/admin/cosmeticSchemas.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { requireAdminAuth, requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { Cosmetic } from "../models/Cosmetic.js";
import { auditLog } from "../services/adminAudit.js";
import { syncDefaultCosmetics } from "../services/cosmetics.js";
import { getAsset } from "../services/assets.js";

const adminCosmeticsRouter = Router();
adminCosmeticsRouter.use(requireAdminAuth);

/** A cosmetic may only reference a published asset owned by that same cosmetic. */
async function assertCosmeticAssetRef(assetRef: string, cosmeticId: string) {
  const asset = await getAsset(assetRef);
  if (asset.ownerType !== "cosmetic" || asset.ownerId !== cosmeticId) {
    throw new HttpError(400, "Asset does not belong to this cosmetic");
  }
  if (asset.status !== "published" || !(asset.publicUrl || asset.variants.some((variant) => variant.name === "full"))) {
    throw new HttpError(400, "Asset is not published and cannot be used by a cosmetic");
  }
}

adminCosmeticsRouter.get("/cosmetics", requirePermission("cosmetics.read"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const { skip, limit, page } = pageParams(req.query as Record<string, unknown>);
    const { type, rarity, q } = req.query;

    const filter: Record<string, unknown> = {};
    if (type && typeof type === "string") filter.type = type;
    if (rarity && typeof rarity === "string") filter.rarity = rarity;
    if (q && typeof q === "string") {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } }
      ];
    }

    const [items, total] = await Promise.all([
      Cosmetic.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Cosmetic.countDocuments(filter)
    ]);

    adminOk(res, {
      data: items,
      meta: paginationMeta(page, limit, total)
    });
  })
);

adminCosmeticsRouter.get("/cosmetics/:id", requirePermission("cosmetics.read"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const cosmetic = await Cosmetic.findById(req.params.id).lean();
    if (!cosmetic) throw new HttpError(404, "Cosmetic not found");
    adminOk(res, { data: cosmetic });
  })
);

adminCosmeticsRouter.post("/cosmetics", requirePermission("cosmetics.write"),
  validateBody(createCosmeticSchema),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const existing = await Cosmetic.findById(req.body.id).lean();
    if (existing) throw new HttpError(409, "Cosmetic with this ID already exists");
    if (req.body.assetRef) await assertCosmeticAssetRef(req.body.assetRef, req.body.id);

    const cosmetic = await Cosmetic.create({ _id: req.body.id, ...req.body });
    await auditLog({
      adminId: req.admin!.id,
      action: "CREATE_COSMETIC",
      entityType: "Cosmetic",
      entityId: cosmetic._id,
      metadata: { name: cosmetic.name, type: cosmetic.type },
      req
    });

    adminOk(res, { data: cosmetic }, {}, 201);
  })
);

adminCosmeticsRouter.put("/cosmetics/:id", requirePermission("cosmetics.write"),
  validateBody(updateCosmeticSchema),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    if (req.body.assetRef) await assertCosmeticAssetRef(req.body.assetRef, req.params.id);
    const cosmetic = await Cosmetic.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!cosmetic) throw new HttpError(404, "Cosmetic not found");

    await auditLog({
      adminId: req.admin!.id,
      action: "UPDATE_COSMETIC",
      entityType: "Cosmetic",
      entityId: cosmetic._id,
      metadata: { id: cosmetic._id, updates: Object.keys(req.body) },
      req
    });

    adminOk(res, { data: cosmetic });
  })
);

adminCosmeticsRouter.delete("/cosmetics/:id", requirePermission("cosmetics.write"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const cosmetic = await Cosmetic.findByIdAndDelete(req.params.id).lean();
    if (!cosmetic) throw new HttpError(404, "Cosmetic not found");

    await auditLog({
      adminId: req.admin!.id,
      action: "DELETE_COSMETIC",
      entityType: "Cosmetic",
      entityId: cosmetic._id,
      metadata: { id: cosmetic._id, name: cosmetic.name },
      req
    });

    adminOk(res, { data: { deleted: true, id: cosmetic._id } });
  })
);

adminCosmeticsRouter.post("/cosmetics/seed", requirePermission("cosmetics.write"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const seeded = await syncDefaultCosmetics();
    await auditLog({
      adminId: req.admin!.id,
      action: "SEED_COSMETICS",
      entityType: "Cosmetic",
      metadata: { seeded },
      req
    });

    adminOk(res, { data: { seeded } });
  })
);

export { adminCosmeticsRouter };
