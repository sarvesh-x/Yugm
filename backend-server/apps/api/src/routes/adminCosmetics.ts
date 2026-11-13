import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { Cosmetic } from "../models/Cosmetic.js";
import { AdminAuditLog } from "../models/AdminAuditLog.js";
import { syncDefaultCosmetics } from "../services/cosmetics.js";

const adminCosmeticsRouter = Router();

const cosmeticTypes = [
  "AVATAR_ASSET", "AVATAR_FRAME", "SPEAKING_WAVE", "PROFILE_THEME",
  "ENTRANCE_EFFECT", "PROFILE_BADGE", "NAME_STYLE", "ROOM_ENTRY",
  "MOOD_STATUS", "PROFILE_MUSIC", "VOICE_BADGE", "ROOM_THEME",
  "AVATAR_DECORATION", "REACTION_PACK", "PROFILE_LAYOUT", "PROFILE_BANNER", "INTRO_CARD",
  "COLLECTIBLE_TITLE", "GIFT_SHELF", "CHAT_BUBBLE", "SEASONAL_EVENT",
  "CALL_SCREEN", "ROOM_BADGE", "ROOM_AMBIENCE"
] as const;

const createCosmeticSchema = z.object({
  id: z.string().min(2).max(64),
  type: z.enum(cosmeticTypes),
  name: z.string().min(2).max(80),
  coinPrice: z.number().int().min(0),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).default("COMMON"),
  preview: z.string().max(120).default(""),
  isActive: z.boolean().default(true),
  assetKind: z.string().max(20).optional(),
  assetUrl: z.string().max(500).optional()
});

const updateCosmeticSchema = z.object({
  type: z.enum(cosmeticTypes).optional(),
  name: z.string().min(2).max(80).optional(),
  coinPrice: z.number().int().min(0).optional(),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).optional(),
  preview: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
  assetKind: z.string().max(20).optional(),
  assetUrl: z.string().max(500).optional()
});

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

    const cosmetic = await Cosmetic.create({ _id: req.body.id, ...req.body });
    await AdminAuditLog.create({
      adminId: req.admin!._id,
      action: "CREATE_COSMETIC",
      entityType: "Cosmetic",
      entityId: cosmetic._id,
      metadata: { name: cosmetic.name, type: cosmetic.type }
    });

    adminOk(res, { data: cosmetic }, {}, 201);
  })
);

adminCosmeticsRouter.put("/cosmetics/:id", requirePermission("cosmetics.write"),
  validateBody(updateCosmeticSchema),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const cosmetic = await Cosmetic.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!cosmetic) throw new HttpError(404, "Cosmetic not found");

    await AdminAuditLog.create({
      adminId: req.admin!._id,
      action: "UPDATE_COSMETIC",
      entityType: "Cosmetic",
      entityId: cosmetic._id,
      metadata: { id: cosmetic._id, updates: Object.keys(req.body) }
    });

    adminOk(res, { data: cosmetic });
  })
);

adminCosmeticsRouter.delete("/cosmetics/:id", requirePermission("cosmetics.write"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const cosmetic = await Cosmetic.findByIdAndDelete(req.params.id).lean();
    if (!cosmetic) throw new HttpError(404, "Cosmetic not found");

    await AdminAuditLog.create({
      adminId: req.admin!._id,
      action: "DELETE_COSMETIC",
      entityType: "Cosmetic",
      entityId: cosmetic._id,
      metadata: { id: cosmetic._id, name: cosmetic.name }
    });

    adminOk(res, { data: { deleted: true, id: cosmetic._id } });
  })
);

adminCosmeticsRouter.post("/cosmetics/seed", requirePermission("cosmetics.write"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const seeded = await syncDefaultCosmetics();
    await AdminAuditLog.create({
      adminId: req.admin!._id,
      action: "SEED_COSMETICS",
      entityType: "Cosmetic",
      metadata: { seeded }
    });

    adminOk(res, { data: { seeded } });
  })
);

export { adminCosmeticsRouter };
