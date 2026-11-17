import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Room } from "../models/Room.js";
import { User } from "../models/User.js";
import { ImmersiveTheme, themeSeeds } from "../models/ImmersiveTheme.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { assertThemeEntitlement, isFreeTheme, purchaseTheme } from "../services/themePurchase.js";

export const roomThemesRouter = Router();

const setRoomThemeSchema = z.object({
  themeKey: z.string().min(1).max(64)
});

const equipThemeSchema = z.object({
  slot: z.enum(["room", "profile", "entrance"]),
  themeKey: z.string().min(1).max(64).nullable()
});

roomThemesRouter.get("/themes", requireAuth, asyncHandler(async (_req: AuthRequest, res) => {
  let themes = await ImmersiveTheme.find({ available: true }).lean();
  if (themes.length === 0) {
    await ImmersiveTheme.insertMany(themeSeeds);
    themes = await ImmersiveTheme.find({ available: true }).lean();
  }
  sendOk(res, { themes });
}));

roomThemesRouter.post("/themes/purchase", requireAuth, validateBody(z.object({ themeKey: z.string().min(1).max(64) })), asyncHandler(async (req: AuthRequest, res) => {
  const result = await purchaseTheme(req.user!.id, req.body.themeKey);
  sendOk(res, { theme: result.theme });
}));

roomThemesRouter.post("/rooms/:id/theme", requireAuth, validateBody(setRoomThemeSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const room = await Room.findById(id).lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  const isHost = room.hostId.toString() === req.user!.id;
  const isCoHost = room.coHostIds?.some((cId) => cId.toString() === req.user!.id);
  if (!isHost && !isCoHost && req.user!.role !== "ADMIN") {
    throw new HttpError(403, "Host or co-host control required", ErrorCode.FORBIDDEN);
  }
  await assertThemeEntitlement(req.user!.id, req.body.themeKey);
  const updated = await Room.findByIdAndUpdate(id, { $set: { theme: req.body.themeKey } }, { new: true }).lean();
  sendOk(res, { room: updated });
}));

roomThemesRouter.get("/user/themes", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id).select("ownedCosmeticIds activeCosmetics").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const owned = await ImmersiveTheme.find({ key: { $in: user.ownedCosmeticIds ?? [] } }).lean();
  const equipped = {
    room: user.activeCosmetics?.roomTheme ?? null,
    profile: user.activeCosmetics?.profileTheme ?? null,
    entrance: user.activeCosmetics?.entranceEffect ?? null
  };
  sendOk(res, { owned, equipped });
}));

roomThemesRouter.post("/user/themes/equip", requireAuth, validateBody(equipThemeSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slot, themeKey } = req.body;
  const theme = themeKey !== null ? await assertThemeEntitlement(req.user!.id, themeKey) : null;
  const fieldMap: Record<string, string> = {
    room: "activeCosmetics.roomTheme",
    profile: "activeCosmetics.profileTheme",
    entrance: "activeCosmetics.entranceEffect"
  };
  const field = fieldMap[slot];
  if (!field) throw new HttpError(400, "Invalid slot", ErrorCode.VALIDATION);
  const update: Record<string, unknown> = {};
  update[field] = themeKey;
  const user = await User.findOneAndUpdate(
    { _id: req.user!.id, ...(theme && !isFreeTheme(theme) ? { ownedCosmeticIds: theme.key } : {}) },
    { $set: update },
    { new: true }
  ).select("ownedCosmeticIds activeCosmetics").lean();
  if (!user) throw new HttpError(403, "Theme is no longer available for this account", ErrorCode.FORBIDDEN);
  const equipped = {
    room: user.activeCosmetics?.roomTheme ?? null,
    profile: user.activeCosmetics?.profileTheme ?? null,
    entrance: user.activeCosmetics?.entranceEffect ?? null
  };
  sendOk(res, { equipped });
}));
