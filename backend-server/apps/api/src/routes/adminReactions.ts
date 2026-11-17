import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { asyncHandler, HttpError, sendOk } from "../utils/http.js";
import { RoomReaction } from "../models/RoomReaction.js";
import { AdminAuditLog } from "../models/AdminAuditLog.js";
import { deleteStoredFile, persistUploadedFile, safeUploadName } from "../services/storage.js";
import { ensureDefaultRoomReactions, normalizeReactionId, toPublicRoomReaction } from "../services/reactions.js";

export const adminReactionsRouter = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, safeUploadName((req as AdminAuthRequest).admin!.id?.toString?.() ?? "admin", file.originalname))
});

function hasImageSignature(filePath: string) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    const hex = buffer.toString("hex");
    const ascii = buffer.toString("ascii");
    return (
      hex.startsWith("ffd8ff") ||
      hex.startsWith("89504e470d0a1a0a") ||
      (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) ||
      (ascii.startsWith("RIFF") && buffer.toString("ascii", 8, 12) === "WEBP")
    );
  } finally {
    fs.closeSync(fd);
  }
}

const reactionUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext) || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files (jpg, jpeg, png, gif, webp) are allowed"));
    }
    cb(null, true);
  }
});

const upsertSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i).optional(),
  label: z.string().trim().min(1).max(60),
  emoji: z.string().trim().max(16).optional(),
  access: z.enum(["EVERYONE", "VIP_EXCLUSIVE"]).default("EVERYONE"),
  assetKind: z.enum(["STATIC", "ANIMATED"]).default("STATIC"),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(-10000).max(10000).optional()
});

adminReactionsRouter.use(requirePermission("cosmetics.write"));

adminReactionsRouter.get("/reactions", asyncHandler(async (req: AdminAuthRequest, res) => {
  await ensureDefaultRoomReactions();
  const { page, limit, skip } = pageParams(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    const q = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ _id: { $regex: q, $options: "i" } }, { label: { $regex: q, $options: "i" } }];
  }
  if (typeof req.query.access === "string" && ["EVERYONE", "VIP_EXCLUSIVE"].includes(req.query.access)) filter.access = req.query.access;
  if (typeof req.query.active === "string") filter.isActive = req.query.active === "true";
  const [items, total] = await Promise.all([
    RoomReaction.find(filter).sort({ sortOrder: 1, createdAt: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    RoomReaction.countDocuments(filter)
  ]);
  adminOk(res, { reactions: items.map((item) => ({ ...toPublicRoomReaction(item as any), isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt, mimeType: item.mimeType ?? "", assetStorageKey: item.assetStorageKey ?? "" })) }, paginationMeta(page, limit, total));
}));

adminReactionsRouter.post("/reactions", reactionUpload.single("asset"), asyncHandler(async (req: AdminAuthRequest, res) => {
  await ensureDefaultRoomReactions();
  const parsed = upsertSchema.parse({ ...req.body, isActive: req.body.isActive ?? "true" });
  const file = req.file;
  const emoji = (parsed.emoji ?? "").trim();
  if (!file && !emoji) throw new HttpError(400, "Provide a reaction image file or an emoji");
  if (file && !hasImageSignature(file.path)) { fs.unlink(file.path, () => {}); throw new HttpError(400, "Invalid image file"); }
  const id = normalizeReactionId(parsed.id || (file ? path.parse(file.originalname).name.replace(/[^a-z0-9_-]+/gi, "_") : "") || `reaction_${Date.now()}`);
  const existing = await RoomReaction.findById(id).lean();
  if (existing) { if (file) fs.unlink(file.path, () => {}); throw new HttpError(409, "A reaction with this id already exists"); }
  let stored: { url: string; key?: string } | null = null;
  if (file) stored = await persistUploadedFile(file, "reactions");
  const reaction = await RoomReaction.create({
    _id: id,
    label: parsed.label,
    emoji,
    access: parsed.access,
    assetKind: parsed.assetKind,
    isActive: parsed.isActive ?? true,
    sortOrder: parsed.sortOrder ?? 0,
    assetUrl: stored?.url ?? "",
    assetStorageKey: stored ? ((stored as any).key ?? path.basename(stored.url)) : "",
    mimeType: file?.mimetype ?? "",
    createdBy: req.admin!._id
  });
  await AdminAuditLog.create({ adminId: req.admin!._id, action: "CREATE_REACTION", entityType: "RoomReaction", entityId: reaction._id, metadata: { access: reaction.access, assetKind: reaction.assetKind, hasAsset: Boolean(file), hasEmoji: Boolean(emoji) } });
  adminOk(res, { reaction: { ...toPublicRoomReaction(reaction), isActive: reaction.isActive } }, {}, 201);
}));

adminReactionsRouter.patch("/reactions/:id", reactionUpload.single("asset"), asyncHandler(async (req: AdminAuthRequest, res) => {
  await ensureDefaultRoomReactions();
  const id = normalizeReactionId(req.params.id);
  const reaction = await RoomReaction.findById(id);
  if (!reaction) throw new HttpError(404, "Reaction not found");
  const parsed = upsertSchema.partial({ label: true }).parse(req.body);
  const file = req.file;
  if (file) {
    if (!hasImageSignature(file.path)) { fs.unlink(file.path, () => {}); throw new HttpError(400, "Invalid image file"); }
    const stored = await persistUploadedFile(file, "reactions");
    const oldKey = reaction.assetStorageKey || reaction.assetUrl;
    reaction.assetUrl = stored.url;
    reaction.assetStorageKey = (stored as any).key ?? path.basename(stored.url);
    reaction.mimeType = file.mimetype;
    await deleteStoredFile("reactions", oldKey);
  }
  if (parsed.label !== undefined) reaction.label = parsed.label;
  if (parsed.emoji !== undefined) reaction.emoji = parsed.emoji.trim();
  if (parsed.access !== undefined) reaction.access = parsed.access;
  if (parsed.assetKind !== undefined) reaction.assetKind = parsed.assetKind;
  if (parsed.isActive !== undefined) reaction.isActive = parsed.isActive;
  if (parsed.sortOrder !== undefined) reaction.sortOrder = parsed.sortOrder;
  await reaction.save();
  await AdminAuditLog.create({ adminId: req.admin!._id, action: "UPDATE_REACTION", entityType: "RoomReaction", entityId: reaction._id, metadata: { updates: Object.keys(req.body || {}), replacedAsset: Boolean(file) } });
  adminOk(res, { reaction: { ...toPublicRoomReaction(reaction), isActive: reaction.isActive } });
}));

adminReactionsRouter.delete("/reactions/:id", asyncHandler(async (req: AdminAuthRequest, res) => {
  await ensureDefaultRoomReactions();
  const id = normalizeReactionId(req.params.id);
  const reaction = await RoomReaction.findById(id).lean();
  if (!reaction) throw new HttpError(404, "Reaction not found");
  await RoomReaction.deleteOne({ _id: id });
  await deleteStoredFile("reactions", reaction.assetStorageKey || reaction.assetUrl);
  await AdminAuditLog.create({ adminId: req.admin!._id, action: "DELETE_REACTION", entityType: "RoomReaction", entityId: id, metadata: { label: reaction.label } });
  adminOk(res, { deleted: true, id });
}));
