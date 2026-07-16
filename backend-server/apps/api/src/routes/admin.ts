import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import * as otplib from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { creatorCoinsToInr } from "../services/withdrawal.js";
import { adminPermissions, adminRoles, permissionsFor, type AdminRole } from "../modules/admin/permissions.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { requireAdminAuth, requireAnyPermission, requirePermission, requireSuperAdmin, signAdminAccessToken, signAdminRefreshToken, hashToken, adminRefreshSecret, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { validateBody } from "../middleware/validate.js";
import { AdminAuditLog } from "../models/AdminAuditLog.js";
import { AdminModerationAction } from "../models/AdminModerationAction.js";
import { AdminSession } from "../models/AdminSession.js";
import { AdminUser } from "../models/AdminUser.js";
import { AppConfig } from "../models/AppConfig.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { Clan } from "../models/Clan.js";
import { ClanMessage } from "../models/ClanMessage.js";
import { NotificationCampaign } from "../models/NotificationCampaign.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { Gift } from "../models/Gift.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { ModerationQueue } from "../models/ModerationQueue.js";
import { Notification } from "../models/Notification.js";
import { PkBattle } from "../models/PkBattle.js";
import { PkEvent } from "../models/PkEvent.js";
import { PayoutReview } from "../models/PayoutReview.js";
import { Purchase } from "../models/Purchase.js";
import { Report } from "../models/Report.js";
import { Room } from "../models/Room.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { User } from "../models/User.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";
import { verifyIdToken } from "../services/firebase.js";
import { createNotification } from "../services/notifications.js";
import { emitRoom } from "../services/socket.js";
import { creditWallet, debitWallet } from "../services/wallet.js";
import { auditLog } from "../services/adminAudit.js";
import { createRazorpayRefund, fetchRazorpayPayment, refundGooglePlayOrder, verifyGooglePlayProduct } from "../services/payments.js";
import { endPkBattle, pkState } from "../services/pk.js";
import { flagSafetyState, refreshUserSafetyStatus } from "../services/safetyScore.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText } from "../utils/http.js";

export const adminRouter = Router();

const adminAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const adminTwoFactorLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id");
const reasonSchema = z.object({ reason: z.string().min(3).max(500), durationHours: z.number().int().min(1).max(8760).optional() });
const notificationTypeValues = ["FOLLOW", "GIFT", "ROOM_INVITE", "SPEAKER_APPROVED", "MESSAGE", "SYSTEM"] as const;
const adminUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(120),
  role: z.enum(adminRoles),
  permissions: z.array(z.enum(adminPermissions)).optional(),
  firebaseUid: z.string().optional(),
  password: z.string().min(8).optional()
});

for (const param of ["adminId", "battleId", "giftId", "id", "messageId", "queueId", "reportId", "roomId", "ticketId", "userId"] as const) {
  adminRouter.param(param, (_req, _res, next, value) => {
    if (!isValidObjectId(String(value))) {
      next(new HttpError(400, `Invalid ${param}`, ErrorCode.VALIDATION));
      return;
    }
    next();
  });
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function adminPublic(admin: any) {
  const permissions = permissionsFor(admin.role, admin.permissions ?? [], admin.isSuperAdmin);
  return {
    id: admin.id ?? admin._id?.toString(),
    email: admin.email,
    displayName: admin.displayName,
    avatarUrl: admin.avatarUrl,
    role: admin.role,
    status: admin.status,
    permissions,
    isSuperAdmin: admin.isSuperAdmin,
    twoFactorEnabled: admin.twoFactorEnabled,
    lastLoginAt: admin.lastLoginAt
  };
}

function ip(req: AdminAuthRequest) {
  return req.ip || req.socket.remoteAddress;
}

async function createAdminSession(admin: any, req: AdminAuthRequest) {
  const session = await AdminSession.create({
    adminId: admin.id,
    refreshTokenHash: "pending",
    ipAddress: ip(req),
    userAgent: req.get("user-agent"),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  const refreshToken = signAdminRefreshToken(admin, session.id);
  session.refreshTokenHash = hashToken(refreshToken);
  await session.save();
  const accessToken = signAdminAccessToken(admin, session.id);
  return { accessToken, refreshToken, session };
}

async function createModerationAction(req: AdminAuthRequest, actionType: string, input: Record<string, unknown>) {
  const action = await AdminModerationAction.create({
    adminId: req.admin!.id,
    actionType,
    ...input
  });
  await auditLog({
    adminId: req.admin!.id,
    action: actionType,
    entityType: String(input.targetType ?? "moderation"),
    entityId: input.targetId as string | undefined,
    targetUserId: input.targetUserId as string | undefined,
    metadata: { moderationActionId: action.id, reason: input.reason, durationHours: input.durationHours },
    req
  });
  return action;
}

async function ensureQueueForReport(report: any) {
  if (!report) return undefined;
  const targetId = report.roomId ?? report.targetUserId;
  if (!targetId) return undefined;
  return ModerationQueue.findOneAndUpdate(
    { reportId: report._id },
    {
      $setOnInsert: {
        reportId: report._id,
        targetType: report.roomId ? "ROOM" : "USER",
        targetId,
        targetUserId: report.targetUserId,
        reason: report.reason,
        priority: report.riskScore >= 80 ? "CRITICAL" : report.riskScore >= 50 ? "HIGH" : "MEDIUM",
        aiScore: report.riskScore
      }
    },
    { upsert: true, new: true }
  );
}

function queryDate(value: unknown) {
  const date = value ? new Date(String(value)) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

function textRegex(value: unknown) {
  const text = String(value || "").trim();
  return text ? new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : undefined;
}

function objectIdQuery(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const id = String(value);
  if (!isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  return id;
}

function purchaseReferenceQuery(reference: string) {
  const clauses: Record<string, unknown>[] = [
    { providerOrderId: reference },
    { providerPaymentId: reference },
    { googleOrderId: reference }
  ];
  if (isValidObjectId(reference)) clauses.unshift({ _id: reference });
  return { $or: clauses };
}

async function findPurchaseByReference(reference: string) {
  return Purchase.findOne(purchaseReferenceQuery(reference));
}

function metadataOf(document: { metadata?: unknown }) {
  return document.metadata && typeof document.metadata === "object" ? document.metadata as Record<string, unknown> : {};
}

function notificationTypeOf(value: unknown): typeof notificationTypeValues[number] {
  return notificationTypeValues.includes(value as typeof notificationTypeValues[number]) ? value as typeof notificationTypeValues[number] : "SYSTEM";
}

async function creditVerifiedPurchase(purchaseId: string, adminId: string, metadata: Record<string, unknown>) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase: any = await Purchase.findOne({
      _id: purchaseId,
      status: { $nin: ["CREDITED", "REFUND_PENDING", "REFUNDED"] }
    }).session(session);
    if (!purchase) {
      await session.commitTransaction();
      session.endSession();
      return { purchase: await Purchase.findById(purchaseId), transaction: null };
    }
    purchase.status = "CREDITED";
    purchase.creditedAt = purchase.creditedAt ?? new Date();
    purchase.metadata = { ...metadataOf(purchase), ...metadata, adminVerifiedAt: new Date().toISOString(), adminVerifiedBy: adminId };
    const [transaction] = await creditWallet(purchase.userId.toString(), purchase.coinAmount, `${purchase.provider}_PURCHASE`, {
      purchaseId: purchase.id,
      packId: purchase.packId,
      provider: purchase.provider,
      adminId,
      ...metadata
    }, session);
    purchase.creditedTransactionId = transaction._id;
    await purchase.save({ session });
    await session.commitTransaction();
    session.endSession();
    return { purchase, transaction };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function reservePurchaseRefund(purchaseId: string, adminId: string, reason: string) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase: any = await Purchase.findById(purchaseId).session(session);
    if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
    if (purchase.status === "REFUNDED") {
      await session.commitTransaction();
      session.endSession();
      return { purchase, transaction: null, alreadyRefunded: true };
    }
    if (purchase.status === "REFUND_PENDING") {
      throw new HttpError(409, "Refund is already pending for this purchase", ErrorCode.CONFLICT);
    }
    if (!["PAID", "CREDITED", "REFUND_FAILED"].includes(purchase.status)) {
      throw new HttpError(400, "Only paid or credited purchases can be refunded", ErrorCode.VALIDATION);
    }
    let transaction: any = null;
    if (purchase.status === "CREDITED") {
      [transaction] = await debitWallet(purchase.userId.toString(), purchase.coinAmount, "PAYMENT_REFUND", {
        purchaseId: purchase.id,
        provider: purchase.provider,
        adminId,
        reason
      }, session);
      purchase.refundTransactionId = transaction._id;
    }
    purchase.status = "REFUND_PENDING";
    purchase.metadata = {
      ...metadataOf(purchase),
      refundReason: reason,
      refundRequestedAt: new Date().toISOString(),
      refundRequestedBy: adminId
    };
    await purchase.save({ session });
    await session.commitTransaction();
    session.endSession();
    return { purchase, transaction, alreadyRefunded: false };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function restoreFailedRefundReservation(purchaseId: string, adminId: string, reason: string, errorMessage: string) {
  const purchase: any = await Purchase.findById(purchaseId);
  if (!purchase) return null;
  const metadata = metadataOf(purchase);
  if (purchase.refundTransactionId && !metadata.refundRollbackTransactionId) {
    const [rollback] = await creditWallet(purchase.userId.toString(), purchase.coinAmount, "ADMIN_ADJUSTMENT", {
      purchaseId: purchase.id,
      provider: purchase.provider,
      adminId,
      reason,
      refundRollback: true
    });
    metadata.refundRollbackTransactionId = rollback._id.toString();
  }
  purchase.status = "REFUND_FAILED";
  purchase.metadata = { ...metadata, refundFailedAt: new Date().toISOString(), refundFailure: errorMessage };
  await purchase.save();
  return purchase;
}

async function finalizePurchaseRefund(purchaseId: string, input: { status: "REFUND_PENDING" | "REFUNDED"; providerRefundId?: string; providerResponse: unknown }) {
  const purchase: any = await Purchase.findById(purchaseId);
  if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
  purchase.status = input.status;
  purchase.refundProviderId = input.providerRefundId ?? purchase.refundProviderId;
  if (input.status === "REFUNDED") purchase.refundedAt = new Date();
  purchase.metadata = {
    ...metadataOf(purchase),
    refundProviderResponse: input.providerResponse,
    refundFinalizedAt: input.status === "REFUNDED" ? new Date().toISOString() : undefined
  };
  await purchase.save();
  return purchase;
}

async function notificationRecipientsForTarget(target: Record<string, unknown>) {
  if (typeof target.userId === "string" && isValidObjectId(target.userId)) {
    return User.find({ _id: target.userId, isBlocked: { $ne: true } }).select("_id").lean();
  }
  const segment = String(target.segment ?? target.type ?? "all_users");
  const filter: Record<string, unknown> =
    segment === "city" && typeof target.city === "string" && target.city.trim()
      ? { city: target.city.trim() }
      : segment === "hosts"
        ? { role: "HOST" }
        : {};
  return User.find({ ...filter, isBlocked: { $ne: true } }).select("_id").limit(5000).lean();
}

adminRouter.post("/auth/login", adminAuthLimiter, validateBody(z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
  firebaseIdToken: z.string().optional()
}).refine((body) => body.firebaseIdToken || (body.email && body.password), "Use Firebase token or email/password")), asyncHandler(async (req: AdminAuthRequest, res) => {
  let admin: any;
  if (req.body.firebaseIdToken) {
    const decoded = await verifyIdToken(req.body.firebaseIdToken);
    admin = await AdminUser.findOne({ firebaseUid: decoded.uid });
    if (!admin) {
      await auditLog({ action: "admin.login.failed", entityType: "admin_user", metadata: { firebaseUid: decoded.uid, email: decoded.email }, req });
      throw new HttpError(401, "Firebase user is not an admin", ErrorCode.UNAUTHORIZED);
    }
  } else {
    admin = await AdminUser.findOne({ email: String(req.body.email).toLowerCase() });
    if (!admin || !admin.passwordHash || !(await bcrypt.compare(req.body.password, admin.passwordHash))) {
      await auditLog({ action: "admin.login.failed", entityType: "admin_user", metadata: { email: req.body.email }, req });
      throw new HttpError(401, "Invalid admin credentials", ErrorCode.UNAUTHORIZED);
    }
  }
  if (admin.status !== "ACTIVE") throw new HttpError(403, "Admin account is not active", ErrorCode.FORBIDDEN);

  if (admin.twoFactorEnabled && admin.twoFactorSecret) {
    const twoFactorToken = crypto.randomBytes(32).toString("base64url");
    const twoFactorTokenHash = hashToken(twoFactorToken);
    await AdminSession.create({
      adminId: admin._id,
      refreshTokenHash: twoFactorTokenHash,
      ipAddress: ip(req),
      userAgent: req.headers["user-agent"] || "",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    adminOk(res, { twoFactorRequired: true, twoFactorToken, adminId: admin._id, email: admin.email, displayName: admin.displayName });
    return;
  }

  const tokens = await createAdminSession(admin, req);
  admin.lastLoginAt = new Date();
  admin.lastLoginIp = ip(req);
  await admin.save();
  await auditLog({ adminId: admin.id, action: "admin.login", entityType: "admin_session", entityId: tokens.session.id, req });
  adminOk(res, { admin: adminPublic(admin), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
}));

adminRouter.post("/auth/2fa/login", adminAuthLimiter, validateBody(z.object({
  twoFactorToken: z.string().min(20),
  token: z.string().length(6).regex(/^\d{6}$/),
  adminId: z.string()
})), asyncHandler(async (req: AdminAuthRequest, res) => {
  const admin = await AdminUser.findById(req.body.adminId);
  if (!admin || admin.status !== "ACTIVE") throw new HttpError(401, "Admin account is not active", ErrorCode.UNAUTHORIZED);
  if (!admin.twoFactorSecret) throw new HttpError(400, "2FA is not configured for this account", ErrorCode.VALIDATION);

  const tokenHash = hashToken(req.body.twoFactorToken);
  const session = await AdminSession.findOne({
    adminId: admin._id,
    refreshTokenHash: tokenHash,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  });
  if (!session) throw new HttpError(401, "2FA session expired or invalid. Please log in again.", ErrorCode.UNAUTHORIZED);

  const isValid = otplib.verify({ token: req.body.token, secret: admin.twoFactorSecret });
  if (!isValid) {
    await auditLog({ action: "admin.2fa.failed", entityType: "admin_user", entityId: admin._id.toString(), metadata: { email: admin.email }, req });
    throw new HttpError(401, "Invalid 2FA code", ErrorCode.UNAUTHORIZED);
  }

  await AdminSession.findByIdAndUpdate(session._id, { revokedAt: new Date() });

  const tokens = await createAdminSession(admin, req);
  admin.lastLoginAt = new Date();
  admin.lastLoginIp = ip(req);
  await admin.save();
  await auditLog({ adminId: admin.id, action: "admin.login", entityType: "admin_session", entityId: tokens.session.id, req });
  adminOk(res, { admin: adminPublic(admin), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
}));

adminRouter.post("/auth/refresh", adminAuthLimiter, validateBody(z.object({ refreshToken: z.string().min(20) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const decoded = jwt.verify(req.body.refreshToken, adminRefreshSecret()) as { sub: string; sessionId: string; type?: string };
  if (decoded.type !== "admin_refresh") throw new HttpError(401, "Invalid refresh token", ErrorCode.UNAUTHORIZED);
  const session = await AdminSession.findOne({ _id: decoded.sessionId, adminId: decoded.sub, refreshTokenHash: hashToken(req.body.refreshToken), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!session) throw new HttpError(401, "Refresh token expired", ErrorCode.UNAUTHORIZED);
  const admin = await AdminUser.findById(decoded.sub);
  if (!admin || admin.status !== "ACTIVE") throw new HttpError(401, "Admin account is not active", ErrorCode.UNAUTHORIZED);
  adminOk(res, { admin: adminPublic(admin), accessToken: signAdminAccessToken(admin, session.id) });
}));

adminRouter.post("/auth/logout", requireAdminAuth, asyncHandler(async (req: AdminAuthRequest, res) => {
  if (req.adminSessionId) await AdminSession.findByIdAndUpdate(req.adminSessionId, { revokedAt: new Date() });
  await auditLog({ adminId: req.admin!.id, action: "admin.logout", entityType: "admin_session", entityId: req.adminSessionId, req });
  adminOk(res, { loggedOut: true });
}));

adminRouter.get("/auth/me", requireAdminAuth, (req: AdminAuthRequest, res) => adminOk(res, { admin: adminPublic(req.admin) }));

adminRouter.post("/auth/invite", requireAdminAuth, requirePermission("settings.manage"), validateBody(adminUserSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (req.body.role === "SUPER_ADMIN" && !req.admin!.isSuperAdmin && req.admin!.role !== "SUPER_ADMIN") {
    throw new HttpError(403, "Only a super admin can invite another super admin", ErrorCode.FORBIDDEN);
  }
  const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 12) : undefined;
  const invitationToken = !passwordHash && !req.body.firebaseUid ? crypto.randomBytes(32).toString("base64url") : undefined;
  const admin = await AdminUser.create({
    email: req.body.email,
    displayName: req.body.displayName,
    role: req.body.role,
    permissions: req.body.permissions ?? [],
    firebaseUid: req.body.firebaseUid,
    passwordHash,
    status: passwordHash || req.body.firebaseUid ? "ACTIVE" : "INVITED",
    isSuperAdmin: req.body.role === "SUPER_ADMIN",
    createdBy: req.admin!.id,
    invitationTokenHash: invitationToken ? hashToken(invitationToken) : undefined,
    invitationExpiresAt: invitationToken ? new Date(Date.now() + 72 * 60 * 60 * 1000) : undefined
  });
  await auditLog({ adminId: req.admin!.id, action: "admin.invite", entityType: "admin_user", entityId: admin.id, metadata: adminPublic(admin), req });
  adminOk(res, { admin: adminPublic(admin), invitationToken }, {}, 201);
}));

adminRouter.post("/auth/accept-invite", adminAuthLimiter, validateBody(z.object({ invitationToken: z.string().min(32), password: z.string().min(8) })), asyncHandler(async (req, res) => {
  const admin = await AdminUser.findOne({
    invitationTokenHash: hashToken(req.body.invitationToken),
    invitationExpiresAt: { $gt: new Date() },
    status: "INVITED"
  }).select("+invitationTokenHash");
  if (!admin) throw new HttpError(404, "Invitation not found", ErrorCode.NOT_FOUND);
  admin.passwordHash = await bcrypt.hash(req.body.password, 12);
  admin.status = "ACTIVE";
  admin.invitationTokenHash = undefined;
  admin.invitationExpiresAt = undefined;
  await admin.save();
  await auditLog({ adminId: admin.id, action: "admin.invite.accepted", entityType: "admin_user", entityId: admin.id, req });
  adminOk(res, { accepted: true });
}));

adminRouter.post("/auth/change-password", requireAdminAuth, validateBody(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (!req.admin!.passwordHash || !(await bcrypt.compare(req.body.currentPassword, req.admin!.passwordHash))) throw new HttpError(403, "Current password is incorrect", ErrorCode.FORBIDDEN);
  req.admin!.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await req.admin!.save();
  await auditLog({ adminId: req.admin!.id, action: "admin.password.changed", entityType: "admin_user", entityId: req.admin!.id, req });
  adminOk(res, { changed: true });
}));

adminRouter.post("/auth/2fa/setup", requireAdminAuth, adminTwoFactorLimiter, asyncHandler(async (req: AdminAuthRequest, res) => {
  if (req.admin!.twoFactorEnabled) throw new HttpError(409, "2FA is already enabled. Disable it first to reconfigure.", ErrorCode.CONFLICT);
  const secret = otplib.generateSecret();
  const serviceName = "Yugm Admin";
  const otpauth = otplib.generateURI({ issuer: serviceName, label: req.admin!.email, secret });
  const qrCode = await QRCode.toDataURL(otpauth);
  req.admin!.twoFactorTempSecret = secret;
  await req.admin!.save();
  adminOk(res, { secret, qrCode, uri: otpauth });
}));

adminRouter.post("/auth/2fa/verify", requireAdminAuth, adminTwoFactorLimiter, validateBody(z.object({ token: z.string().length(6).regex(/^\d{6}$/) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const secret = req.admin!.twoFactorTempSecret || req.admin!.twoFactorSecret;
  if (!secret) throw new HttpError(400, "No 2FA secret found. Start setup first.", ErrorCode.VALIDATION);
  const isValid = otplib.verify({ token: req.body.token, secret });
  if (!isValid) throw new HttpError(400, "Invalid verification code", ErrorCode.VALIDATION);
  if (!req.admin!.twoFactorEnabled && req.admin!.twoFactorTempSecret) {
    req.admin!.twoFactorSecret = req.admin!.twoFactorTempSecret;
    req.admin!.twoFactorTempSecret = undefined;
    req.admin!.twoFactorEnabled = true;
    await req.admin!.save();
    await auditLog({ adminId: req.admin!.id, action: "admin.2fa.enabled", entityType: "admin_user", entityId: req.admin!.id, req });
  }
  adminOk(res, { verified: true, enabled: req.admin!.twoFactorEnabled });
}));

adminRouter.post("/auth/2fa/disable", requireAdminAuth, adminTwoFactorLimiter, validateBody(z.object({ token: z.string().length(6).regex(/^\d{6}$/), password: z.string().optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (!req.admin!.twoFactorSecret) throw new HttpError(400, "2FA is not enabled", ErrorCode.VALIDATION);
  if (req.body.password) {
    if (!req.admin!.passwordHash || !(await bcrypt.compare(req.body.password, req.admin!.passwordHash))) throw new HttpError(403, "Password is incorrect", ErrorCode.FORBIDDEN);
  } else {
    const isValid = otplib.verify({ token: req.body.token, secret: req.admin!.twoFactorSecret });
    if (!isValid) throw new HttpError(400, "Invalid verification code", ErrorCode.VALIDATION);
  }
  req.admin!.twoFactorSecret = undefined;
  req.admin!.twoFactorTempSecret = undefined;
  req.admin!.twoFactorEnabled = false;
  await req.admin!.save();
  await auditLog({ adminId: req.admin!.id, action: "admin.2fa.disabled", entityType: "admin_user", entityId: req.admin!.id, req });
  adminOk(res, { disabled: true });
}));

adminRouter.post("/auth/2fa/status", requireAdminAuth, asyncHandler(async (req: AdminAuthRequest, res) => {
  adminOk(res, { enabled: req.admin!.twoFactorEnabled, email: req.admin!.email });
}));

adminRouter.use(requireAdminAuth);

adminRouter.get("/dashboard/overview", requirePermission("analytics.read"), asyncHandler(async (_req: AdminAuthRequest, res) => {
  const today = startOfDay();
  const month = startOfMonth();
  const [totalUsers, activeToday, newToday, banned, suspended, liveNow, voiceLive, videoLive, createdToday, endedToday, pendingReports, criticalReports, resolvedToday, coinsPurchasedAgg, coinsSpentAgg, giftAgg, grossTodayAgg, grossMonthAgg] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ updatedAt: { $gte: today } }),
    User.countDocuments({ createdAt: { $gte: today } }),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ suspendedUntil: { $gt: new Date() } }),
    Room.countDocuments({ status: "LIVE" }),
    Room.countDocuments({ status: "LIVE", type: "VOICE" }),
    Room.countDocuments({ status: "LIVE", type: "VIDEO" }),
    Room.countDocuments({ createdAt: { $gte: today } }),
    Room.countDocuments({ endedAt: { $gte: today } }),
    Report.countDocuments({ status: "PENDING" }),
    ModerationQueue.countDocuments({ status: { $in: ["PENDING", "IN_REVIEW", "ESCALATED"] }, priority: "CRITICAL" }),
    Report.countDocuments({ reviewedAt: { $gte: today } }),
    WalletTransaction.aggregate([{ $match: { type: "CREDIT", source: { $in: ["RAZORPAY_PURCHASE", "GOOGLE_PLAY_PURCHASE", "RECHARGE"] }, createdAt: { $gte: today } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
    WalletTransaction.aggregate([{ $match: { type: "DEBIT", createdAt: { $gte: today } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
    GiftTransaction.aggregate([{ $match: { createdAt: { $gte: today } } }, { $group: { _id: null, amount: { $sum: "$coinAmount" } } }]),
    Purchase.aggregate([{ $match: { status: "CREDITED", createdAt: { $gte: today } } }, { $group: { _id: null, amount: { $sum: "$amountInr" } } }]),
    Purchase.aggregate([{ $match: { status: "CREDITED", createdAt: { $gte: month } } }, { $group: { _id: null, amount: { $sum: "$amountInr" } } }])
  ]);
  adminOk(res, {
    users: { total: totalUsers, activeToday, newToday, banned, suspended },
    rooms: { liveNow, voiceLive, videoLive, createdToday, endedToday },
    moderation: { pendingReports, criticalReports, resolvedToday, averageResolutionTimeMinutes: 0 },
    wallet: {
      coinsPurchasedToday: coinsPurchasedAgg[0]?.amount ?? 0,
      coinsSpentToday: coinsSpentAgg[0]?.amount ?? 0,
      giftValueToday: giftAgg[0]?.amount ?? 0,
      withdrawalPendingAmount: 0
    },
    revenue: { grossToday: grossTodayAgg[0]?.amount ?? 0, grossMonth: grossMonthAgg[0]?.amount ?? 0, refundsToday: 0 }
  });
}));

adminRouter.get("/dashboard/live-rooms", requirePermission("rooms.read"), asyncHandler(async (_req, res) => {
  const rooms = await Room.find({ status: "LIVE" }).populate("hostId", "name username avatar isBlocked suspendedUntil").sort({ participantCount: -1 }).limit(50).lean();
  adminOk(res, rooms);
}));

adminRouter.get("/pk/battles", requirePermission("rooms.read"), asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  const battles = await PkBattle.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  adminOk(res, await Promise.all(battles.map((battle) => pkState(battle))));
}));

adminRouter.get("/pk/battles/live", requirePermission("rooms.read"), asyncHandler(async (_req, res) => {
  const battles = await PkBattle.find({ status: "ACTIVE" }).sort({ startedAt: -1 }).limit(100).lean();
  adminOk(res, await Promise.all(battles.map((battle) => pkState(battle))));
}));

adminRouter.get("/pk/battles/:battleId", requirePermission("rooms.read"), asyncHandler(async (req, res) => {
  adminOk(res, { battle: await pkState(req.params.battleId) });
}));

adminRouter.get("/pk/battles/:battleId/events", requirePermission("rooms.read"), asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battle id", ErrorCode.VALIDATION);
  adminOk(res, await PkEvent.find({ battleId: req.params.battleId }).sort({ createdAt: -1 }).limit(200).lean());
}));

adminRouter.post("/pk/battles/:battleId/end", requirePermission("rooms.end"), validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const result = await endPkBattle({ battleId: req.params.battleId, force: true, reason: req.body.reason ?? "Admin force end" });
  await auditLog({ adminId: req.admin!.id, action: "pk.force_ended", entityType: "pk_battle", entityId: req.params.battleId, metadata: { reason: req.body.reason }, req });
  adminOk(res, result);
}));

adminRouter.post("/pk/battles/:battleId/flag", requirePermission("reports.resolve"), validateBody(z.object({ reason: z.string().min(3).max(500) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battle id", ErrorCode.VALIDATION);
  const battleExists = await PkBattle.exists({ _id: req.params.battleId });
  if (!battleExists) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  const log = await auditLog({ adminId: req.admin!.id, action: "pk.flagged", entityType: "pk_battle", entityId: req.params.battleId, metadata: { reason: req.body.reason }, req });
  adminOk(res, { flagged: true, auditLog: log });
}));

adminRouter.get("/dashboard/system-health", requirePermission("analytics.read"), (_req, res) => {
  adminOk(res, { uptimeSeconds: Math.round(process.uptime()), memory: process.memoryUsage(), node: process.version, mongoState: mongoose.connection.readyState });
});

adminRouter.get("/dashboard/revenue", requirePermission("analytics.read"), asyncHandler(async (req, res) => {
  const from = queryDate(req.query.from) ?? startOfMonth();
  const purchases = await Purchase.aggregate([{ $match: { createdAt: { $gte: from }, status: "CREDITED" } }, { $group: { _id: "$provider", gross: { $sum: "$amountInr" }, coins: { $sum: "$coinAmount" }, count: { $sum: 1 } } }]);
  adminOk(res, purchases);
}));

adminRouter.get("/dashboard/moderation", requirePermission("analytics.read"), asyncHandler(async (_req, res) => {
  const byStatus = await Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const queue = await ModerationQueue.aggregate([{ $group: { _id: { status: "$status", priority: "$priority" }, count: { $sum: 1 } } }]);
  adminOk(res, { reports: byStatus, queue });
}));

adminRouter.get("/dashboard/user-growth", requirePermission("analytics.read"), asyncHandler(async (req, res) => {
  const from = queryDate(req.query.from) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const users = await User.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  adminOk(res, users);
}));

adminRouter.get("/dashboard/top-hosts", requirePermission("analytics.read"), asyncHandler(async (_req, res) => {
  const hosts = await Room.aggregate([{ $group: { _id: "$hostId", rooms: { $sum: 1 }, liveRooms: { $sum: { $cond: [{ $eq: ["$status", "LIVE"] }, 1, 0] } } } }, { $sort: { rooms: -1 } }, { $limit: 20 }]);
  await User.populate(hosts, { path: "_id", select: "name username avatar followersCount" });
  adminOk(res, hosts);
}));

adminRouter.get("/dashboard/top-gifts", requirePermission("analytics.read"), asyncHandler(async (_req, res) => {
  const gifts = await GiftTransaction.aggregate([{ $group: { _id: "$giftId", count: { $sum: 1 }, value: { $sum: "$coinAmount" } } }, { $sort: { value: -1 } }, { $limit: 20 }]);
  await Gift.populate(gifts, { path: "_id", select: "name icon coinPrice" });
  adminOk(res, gifts);
}));

adminRouter.get("/dashboard/experience", requirePermission("analytics.read"), asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    scheduledRooms,
    privateRooms,
    speakerRequests,
    invites,
    follows,
    giftIncome,
    unreadNotifications,
    topCreators,
    levelLeaders,
    pendingModeration
  ] = await Promise.all([
    Room.countDocuments({ status: "SCHEDULED" }),
    Room.countDocuments({ visibility: "PRIVATE", createdAt: { $gte: since } }),
    SpeakerRequest.countDocuments({ createdAt: { $gte: since } }),
    RoomInvite.countDocuments({ createdAt: { $gte: since } }),
    Follow.countDocuments({ createdAt: { $gte: since } }),
    GiftTransaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: null, coins: { $sum: "$coinAmount" }, count: { $sum: 1 } } }
    ]),
    Notification.countDocuments({ read: false }),
    GiftTransaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$receiverId", coins: { $sum: "$coinAmount" }, gifts: { $sum: 1 } } },
      { $sort: { coins: -1 } },
      { $limit: 8 }
    ]),
    User.find({ isBlocked: { $ne: true } }).select("name username avatar level xp followersCount").sort({ level: -1, xp: -1 }).limit(8).lean(),
    ModerationQueue.countDocuments({ status: { $in: ["OPEN", "IN_REVIEW", "ESCALATED"] } })
  ]);
  const creatorIds = topCreators.map((row) => row._id);
  const creators = await User.find({ _id: { $in: creatorIds } }).select("name username avatar city").lean();
  const creatorMap = new Map(creators.map((creator) => [creator._id.toString(), creator]));
  const giftSummary = giftIncome[0] ?? { coins: 0, count: 0 };
  adminOk(res, {
    windowDays: 30,
    adoption: {
      scheduledRooms,
      privateRooms,
      speakerRequests,
      invites,
      follows,
      unreadNotifications,
      pendingModeration
    },
    creatorEconomy: {
      giftCoins: giftSummary.coins,
      giftCount: giftSummary.count,
      estimatedInr: creatorCoinsToInr(giftSummary.coins),
      topCreators: topCreators.map((row) => ({
        ...row,
        creator: creatorMap.get(row._id?.toString?.() ?? "")
      }))
    },
    gamification: {
      levelLeaders,
      missions: ["Daily check-in", "Room hosting", "Gift streaks", "Follow graph", "Speaker requests"]
    },
    recommendations: [
      scheduledRooms < 5 ? "Promote scheduled-room creation in creator onboarding." : "Scheduled rooms are gaining traction.",
      pendingModeration > 20 ? "Moderation queue needs attention before growth pushes." : "Safety queue is currently manageable.",
      giftSummary.coins < 1000 ? "Run a small gift campaign to activate creator earnings." : "Creator gifting is active."
    ]
  });
}));

adminRouter.get("/users", requirePermission("users.read"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  const search = textRegex(req.query.search);
  if (search) filter.$or = [{ name: search }, { username: search }, { email: search }, { phone: search }, { city: search }];
  if (req.query.role) filter.role = req.query.role;
  if (req.query.city) filter.city = textRegex(req.query.city);
  if (req.query.gender) filter.gender = req.query.gender;
  if (req.query.status === "banned") filter.isBlocked = true;
  if (req.query.status === "suspended") filter.suspendedUntil = { $gt: new Date() };
  if (req.query.ageMin || req.query.ageMax) filter.age = { ...(req.query.ageMin ? { $gte: Number(req.query.ageMin) } : {}), ...(req.query.ageMax ? { $lte: Number(req.query.ageMax) } : {}) };
  const createdFrom = queryDate(req.query.createdFrom);
  const createdTo = queryDate(req.query.createdTo);
  if (createdFrom || createdTo) filter.createdAt = { ...(createdFrom ? { $gte: createdFrom } : {}), ...(createdTo ? { $lte: createdTo } : {}) };
  const sortBy = String(req.query.sortBy || "createdAt");
  const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;
  const [users, total] = await Promise.all([
    User.find(filter).select("-__v").sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  adminOk(res, users, paginationMeta(page, limit, total));
}));

adminRouter.get("/users/:userId", requirePermission("users.read"), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
  const [user, safety, reportsReceived, reportsSubmitted, walletSummary, matchCount, blockCount, actions] = await Promise.all([
    User.findById(req.params.userId).select("-__v").lean(),
    refreshUserSafetyStatus(req.params.userId),
    Report.countDocuments({ targetUserId: req.params.userId }),
    Report.countDocuments({ reporterId: req.params.userId }),
    WalletTransaction.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(req.params.userId) } }, { $group: { _id: "$type", amount: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    mongoose.model("Match").countDocuments({ users: req.params.userId }).catch(() => 0),
    mongoose.model("Block").countDocuments({ $or: [{ blockerId: req.params.userId }, { blockedUserId: req.params.userId }] }).catch(() => 0),
    AdminModerationAction.find({ targetUserId: req.params.userId }).sort({ createdAt: -1 }).limit(25).lean()
  ]);
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  await auditLog({ adminId: req.admin!.id, action: "user.viewed", entityType: "user", entityId: req.params.userId, targetUserId: req.params.userId, req });
  adminOk(res, { user, safety, reportsReceived, reportsSubmitted, walletSummary, matchCount, blockCount, actions });
}));

adminRouter.patch("/users/:userId", requirePermission("users.update"), validateBody(z.object({
  name: z.string().min(1).max(120).optional(),
  username: z.string().min(3).max(40).optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(80).optional(),
  isVerified: z.boolean().optional(),
  role: z.enum(["USER", "HOST", "MODERATOR", "ADMIN"]).optional()
})), asyncHandler(async (req: AdminAuthRequest, res) => {
  const before = await User.findById(req.params.userId).lean();
  const user = await User.findByIdAndUpdate(req.params.userId, { $set: req.body }, { new: true }).select("-__v").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  await auditLog({ adminId: req.admin!.id, action: "user.updated", entityType: "user", entityId: req.params.userId, targetUserId: req.params.userId, metadata: { before, after: user }, req });
  adminOk(res, { user });
}));

adminRouter.post("/users/:userId/warn", requireAnyPermission(["users.suspend", "reports.resolve"]), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  await createNotification(req.params.userId, "SYSTEM", "Community warning", req.body.reason, { type: "ADMIN_WARNING" });
  await createModerationAction(req, "WARNING_SENT", { targetType: "USER", targetId: req.params.userId, targetUserId: req.params.userId, reason: req.body.reason });
  await UserSafetyStatus.findOneAndUpdate({ userId: req.params.userId }, { $inc: { warningCount: 1 }, $set: { lastReviewedBy: req.admin!.id, lastReviewedAt: new Date() } }, { upsert: true });
  adminOk(res, { warned: true });
}));

adminRouter.post("/users/:userId/suspend", requirePermission("users.suspend"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const suspendedUntil = new Date(Date.now() + (req.body.durationHours ?? 24) * 60 * 60 * 1000);
  const user = await User.findByIdAndUpdate(req.params.userId, { suspendedUntil, moderationReason: req.body.reason, $inc: { moderationStrikes: 1 } }, { new: true }).lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  await createModerationAction(req, "USER_SUSPENDED", { targetType: "USER", targetId: req.params.userId, targetUserId: req.params.userId, reason: req.body.reason, durationHours: req.body.durationHours });
  await refreshUserSafetyStatus(req.params.userId, req.admin!.id);
  await UserSafetyStatus.findOneAndUpdate(
    { userId: req.params.userId },
    { $inc: { suspensionCount: 1 }, $set: { lastReviewedBy: req.admin!.id, lastReviewedAt: new Date() } },
    { upsert: true }
  );
  adminOk(res, { user });
}));

adminRouter.post("/users/:userId/ban", requirePermission("users.ban"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { isBlocked: true, moderationReason: req.body.reason, $inc: { moderationStrikes: 1, tokenVersion: 1 } }, { new: true }).lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  await createModerationAction(req, "USER_BANNED", { targetType: "USER", targetId: req.params.userId, targetUserId: req.params.userId, reason: req.body.reason });
  await refreshUserSafetyStatus(req.params.userId, req.admin!.id);
  adminOk(res, { user });
}));

adminRouter.post("/users/:userId/unban", requirePermission("users.ban"), validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { isBlocked: false, $unset: { moderationReason: "", suspendedUntil: "", mutedUntil: "" } }, { new: true }).lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  await createModerationAction(req, "USER_UNBANNED", { targetType: "USER", targetId: req.params.userId, targetUserId: req.params.userId, reason: req.body.reason });
  adminOk(res, { user });
}));

for (const [path, field, auditAction] of [
  ["shadow-ban", "isShadowBanned", "user.shadow_banned"],
  ["remove-shadow-ban", "isShadowBanned", "user.shadow_ban.removed"],
  ["restrict-chat", "isChatRestricted", "user.chat_restricted"],
  ["restrict-rooms", "isRoomRestricted", "user.rooms_restricted"],
  ["freeze-wallet", "isWalletFrozen", "user.wallet_frozen"],
  ["unfreeze-wallet", "isWalletFrozen", "user.wallet_unfrozen"]
] as const) {
  adminRouter.post(`/users/:userId/${path}`, requireAnyPermission(["users.suspend", "wallet.adjust"]), validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
    const enabled = !path.startsWith("remove-") && !path.startsWith("unfreeze");
    const safety = await flagSafetyState(req.params.userId, { [field]: enabled }, req.admin!.id);
    await auditLog({ adminId: req.admin!.id, action: auditAction, entityType: "user_safety_status", entityId: safety.id, targetUserId: req.params.userId, metadata: { reason: req.body.reason, [field]: enabled }, req });
    adminOk(res, { safety });
  }));
}

adminRouter.get("/users/:userId/activity", requirePermission("users.read"), asyncHandler(async (req, res) => {
  const [rooms, messages, transactions, reports] = await Promise.all([
    Room.find({ hostId: req.params.userId }).sort({ createdAt: -1 }).limit(50).lean(),
    ChatMessage.find({ senderId: req.params.userId }).sort({ createdAt: -1 }).limit(50).lean(),
    WalletTransaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Report.find({ $or: [{ reporterId: req.params.userId }, { targetUserId: req.params.userId }] }).sort({ createdAt: -1 }).limit(50).lean()
  ]);
  adminOk(res, { rooms, messages, transactions, reports });
}));

adminRouter.get("/users/:userId/reports", requirePermission("reports.read"), asyncHandler(async (req, res) => adminOk(res, await Report.find({ targetUserId: req.params.userId }).sort({ createdAt: -1 }).limit(100).lean())));
adminRouter.get("/users/:userId/wallet", requirePermission("wallet.read"), asyncHandler(async (req, res) => adminOk(res, await WalletTransaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(100).lean())));
adminRouter.get("/users/:userId/rooms", requirePermission("rooms.read"), asyncHandler(async (req, res) => adminOk(res, await Room.find({ hostId: req.params.userId }).sort({ createdAt: -1 }).limit(100).lean())));
adminRouter.get("/users/:userId/chats", requirePermission("messages.read_private"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const messages = await DirectMessage.find({ $or: [{ senderId: req.params.userId }, { receiverId: req.params.userId }] }).sort({ createdAt: -1 }).limit(100).lean();
  await auditLog({ adminId: req.admin!.id, action: "private_chat.viewed", entityType: "direct_message", targetUserId: req.params.userId, metadata: { count: messages.length }, req });
  adminOk(res, messages);
}));
adminRouter.get("/users/:userId/audit", requirePermission("audit.read"), asyncHandler(async (req, res) => adminOk(res, await AdminAuditLog.find({ targetUserId: req.params.userId }).sort({ createdAt: -1 }).limit(100).lean())));

adminRouter.get("/profiles/pending-review", requirePermission("profiles.review"), asyncHandler(async (_req, res) => {
  const users = await User.find({ profileCompletedAt: { $exists: true }, isVerified: { $ne: true }, isBlocked: { $ne: true } }).sort({ profileCompletedAt: -1 }).limit(100).lean();
  adminOk(res, users);
}));
adminRouter.get("/profiles/:userId", requirePermission("profiles.review"), asyncHandler(async (req, res) => adminOk(res, { user: await User.findById(req.params.userId).select("-__v").lean(), safety: await refreshUserSafetyStatus(req.params.userId) })));
adminRouter.post("/profiles/:userId/approve", requirePermission("profiles.review"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { isVerified: true }, { new: true }).lean();
  await auditLog({ adminId: req.admin!.id, action: "profile.approved", entityType: "user", entityId: req.params.userId, targetUserId: req.params.userId, req });
  adminOk(res, { user });
}));
adminRouter.post("/profiles/:userId/reject", requirePermission("profiles.review"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  await auditLog({ adminId: req.admin!.id, action: "profile.rejected", entityType: "user", entityId: req.params.userId, targetUserId: req.params.userId, metadata: { reason: req.body.reason }, req });
  adminOk(res, { rejected: true });
}));
adminRouter.post("/profiles/:userId/verify", requirePermission("profiles.verify"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { isVerified: true }, { new: true }).lean();
  await auditLog({ adminId: req.admin!.id, action: "profile.verified", entityType: "user", entityId: req.params.userId, targetUserId: req.params.userId, req });
  adminOk(res, { user });
}));
adminRouter.post("/profiles/:userId/remove-verification", requirePermission("profiles.verify"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { isVerified: false }, { new: true }).lean();
  await auditLog({ adminId: req.admin!.id, action: "profile.verification_removed", entityType: "user", entityId: req.params.userId, targetUserId: req.params.userId, req });
  adminOk(res, { user });
}));
adminRouter.post("/profiles/:userId/hide-photo", requirePermission("profiles.review"), validateBody(z.object({ photoUrl: z.string().url().optional(), reason: z.string().min(3).max(500) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  await createModerationAction(req, "PHOTO_REMOVED", { targetType: "PHOTO", targetUserId: req.params.userId, reason: req.body.reason, metadata: { photoUrl: req.body.photoUrl } });
  adminOk(res, { hidden: true });
}));
adminRouter.post("/profiles/:userId/remove-photo", requirePermission("profiles.review"), validateBody(z.object({ photoUrl: z.string().url().optional(), reason: z.string().min(3).max(500) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  await createModerationAction(req, "PHOTO_REMOVED", { targetType: "PHOTO", targetUserId: req.params.userId, reason: req.body.reason, metadata: { photoUrl: req.body.photoUrl } });
  adminOk(res, { removed: true });
}));
adminRouter.post("/profiles/:userId/request-changes", requirePermission("profiles.review"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  await createNotification(req.params.userId, "SYSTEM", "Profile changes requested", req.body.reason, { type: "PROFILE_REVIEW" });
  await auditLog({ adminId: req.admin!.id, action: "profile.changes_requested", entityType: "user", entityId: req.params.userId, targetUserId: req.params.userId, metadata: { reason: req.body.reason }, req });
  adminOk(res, { requested: true });
}));

adminRouter.get("/rooms", requirePermission("rooms.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  if (req.query.roomType) filter.type = req.query.roomType;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = textRegex(req.query.category);
  if (req.query.language) filter.language = textRegex(req.query.language);
  const hostId = objectIdQuery(req.query.hostId, "hostId");
  if (hostId) filter.hostId = hostId;
  const search = textRegex(req.query.search);
  if (search) filter.$or = [{ title: search }, { description: search }, { tags: search }];
  const [rooms, total] = await Promise.all([
    Room.find(filter).populate("hostId", "name username avatar isBlocked").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Room.countDocuments(filter)
  ]);
  adminOk(res, rooms, paginationMeta(page, limit, total));
}));
adminRouter.get("/rooms/live", requirePermission("rooms.read"), asyncHandler(async (_req, res) => adminOk(res, await Room.find({ status: "LIVE" }).populate("hostId", "name username avatar").sort({ participantCount: -1 }).limit(100).lean())));
adminRouter.get("/rooms/:roomId", requirePermission("rooms.read"), asyncHandler(async (req, res) => {
  const [room, participants, messages, gifts, reports] = await Promise.all([
    Room.findById(req.params.roomId).populate("hostId", "name username avatar activeCosmetics").lean(),
    RoomParticipant.find({ roomId: req.params.roomId, leftAt: null }).populate("userId", "name username avatar").lean(),
    ChatMessage.find({ roomId: req.params.roomId }).populate("senderId", "name username avatar").sort({ createdAt: -1 }).limit(100).lean(),
    GiftTransaction.find({ roomId: req.params.roomId }).populate("senderId receiverId giftId").sort({ createdAt: -1 }).limit(100).lean(),
    Report.find({ roomId: req.params.roomId }).sort({ createdAt: -1 }).limit(50).lean()
  ]);
  adminOk(res, { room, participants, messages, gifts, reports });
}));
adminRouter.post("/rooms/:roomId/end", requirePermission("rooms.end"), validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const room = await Room.findByIdAndUpdate(req.params.roomId, { status: "ENDED", endedAt: new Date() }, { new: true }).lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  emitRoom(req.params.roomId, "room:ended", { roomId: req.params.roomId, reason: req.body.reason });
  await createModerationAction(req, "ROOM_ENDED", { targetType: "ROOM", targetId: req.params.roomId, targetUserId: room.hostId?.toString(), reason: req.body.reason });
  adminOk(res, { room });
}));
adminRouter.post("/rooms/:roomId/feature", requirePermission("rooms.feature"), asyncHandler(async (req: AdminAuthRequest, res) => {
  await auditLog({ adminId: req.admin!.id, action: "room.featured", entityType: "room", entityId: req.params.roomId, req });
  adminOk(res, { featured: true });
}));
adminRouter.post("/rooms/:roomId/unfeature", requirePermission("rooms.feature"), asyncHandler(async (req: AdminAuthRequest, res) => {
  await auditLog({ adminId: req.admin!.id, action: "room.unfeatured", entityType: "room", entityId: req.params.roomId, req });
  adminOk(res, { featured: false });
}));
adminRouter.post("/rooms/:roomId/lock", requirePermission("rooms.moderate"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const room = await Room.findByIdAndUpdate(req.params.roomId, { visibility: "PRIVATE" }, { new: true }).lean();
  emitRoom(req.params.roomId, "admin:room:lock", { roomId: req.params.roomId });
  await auditLog({ adminId: req.admin!.id, action: "room.locked", entityType: "room", entityId: req.params.roomId, req });
  adminOk(res, { room });
}));
adminRouter.post("/rooms/:roomId/unlock", requirePermission("rooms.moderate"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const room = await Room.findByIdAndUpdate(req.params.roomId, { visibility: "PUBLIC" }, { new: true }).lean();
  emitRoom(req.params.roomId, "admin:room:unlock", { roomId: req.params.roomId });
  await auditLog({ adminId: req.admin!.id, action: "room.unlocked", entityType: "room", entityId: req.params.roomId, req });
  adminOk(res, { room });
}));
adminRouter.post("/rooms/:roomId/remove-user", requirePermission("rooms.moderate"), validateBody(z.object({ userId: objectIdSchema, reason: z.string().max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  await RoomParticipant.findOneAndUpdate({ roomId: req.params.roomId, userId: req.body.userId, leftAt: null }, { leftAt: new Date() });
  emitRoom(req.params.roomId, "admin:room:user:remove", { userId: req.body.userId });
  await auditLog({ adminId: req.admin!.id, action: "room.user_removed", entityType: "room", entityId: req.params.roomId, targetUserId: req.body.userId, metadata: { reason: req.body.reason }, req });
  adminOk(res, { removed: true });
}));
adminRouter.post("/rooms/:roomId/mute-user", requirePermission("rooms.moderate"), validateBody(z.object({ userId: objectIdSchema, reason: z.string().max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  await User.findByIdAndUpdate(req.body.userId, { mutedUntil: new Date(Date.now() + 60 * 60 * 1000), moderationReason: req.body.reason || "Muted by room moderator" });
  emitRoom(req.params.roomId, "admin:room:user:mute", { userId: req.body.userId });
  await auditLog({ adminId: req.admin!.id, action: "room.user_muted", entityType: "room", entityId: req.params.roomId, targetUserId: req.body.userId, metadata: { reason: req.body.reason }, req });
  adminOk(res, { muted: true });
}));
adminRouter.post("/rooms/:roomId/ban-user-from-room", requirePermission("rooms.moderate"), validateBody(z.object({ userId: objectIdSchema, reason: z.string().max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  await RoomParticipant.findOneAndUpdate({ roomId: req.params.roomId, userId: req.body.userId, leftAt: null }, { leftAt: new Date() });
  await auditLog({ adminId: req.admin!.id, action: "room.user_banned", entityType: "room", entityId: req.params.roomId, targetUserId: req.body.userId, metadata: { reason: req.body.reason }, req });
  adminOk(res, { banned: true });
}));
adminRouter.get("/rooms/:roomId/participants", requirePermission("rooms.read"), asyncHandler(async (req, res) => adminOk(res, await RoomParticipant.find({ roomId: req.params.roomId }).populate("userId", "name username avatar").lean())));
adminRouter.get("/rooms/:roomId/messages", requirePermission("messages.read"), asyncHandler(async (req, res) => adminOk(res, await ChatMessage.find({ roomId: req.params.roomId }).populate("senderId", "name username avatar").sort({ createdAt: -1 }).limit(200).lean())));
adminRouter.get("/rooms/:roomId/gifts", requirePermission("wallet.read"), asyncHandler(async (req, res) => adminOk(res, await GiftTransaction.find({ roomId: req.params.roomId }).populate("senderId receiverId giftId").sort({ createdAt: -1 }).limit(200).lean())));
adminRouter.get("/rooms/:roomId/reports", requirePermission("reports.read"), asyncHandler(async (req, res) => adminOk(res, await Report.find({ roomId: req.params.roomId }).sort({ createdAt: -1 }).limit(100).lean())));

adminRouter.post("/live/rooms/:roomId/warning", requirePermission("rooms.moderate"), validateBody(z.object({ message: z.string().min(3).max(300) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  emitRoom(req.params.roomId, "admin:room:warning", { message: sanitizeText(req.body.message), adminId: req.admin!.id });
  await auditLog({ adminId: req.admin!.id, action: "room.warning_sent", entityType: "room", entityId: req.params.roomId, metadata: { message: req.body.message }, req });
  adminOk(res, { sent: true });
}));
adminRouter.post("/live/rooms/:roomId/escalate", requirePermission("rooms.moderate"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const queue = await ModerationQueue.create({ targetType: "ROOM", targetId: req.params.roomId, priority: "CRITICAL", status: "ESCALATED", reason: req.body.reason, assignedTo: req.admin!.id });
  await auditLog({ adminId: req.admin!.id, action: "room.escalated", entityType: "room", entityId: req.params.roomId, metadata: { queueId: queue.id, reason: req.body.reason }, req });
  adminOk(res, { queue }, {}, 201);
}));

adminRouter.get("/reports", requirePermission("reports.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.reason) filter.reason = textRegex(req.query.reason);
  if (req.query.targetType === "ROOM") filter.roomId = { $exists: true };
  if (req.query.targetType === "USER") filter.targetUserId = { $exists: true };
  const [reports, total] = await Promise.all([
    Report.find(filter).populate("reporterId targetUserId roomId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Report.countDocuments(filter)
  ]);
  await Promise.all(reports.map((report: any) => ensureQueueForReport(report)));
  adminOk(res, reports, paginationMeta(page, limit, total));
}));
adminRouter.get("/reports/:reportId", requirePermission("reports.read"), asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.reportId).populate("reporterId targetUserId roomId").lean();
  if (!report) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
  const queue = await ensureQueueForReport(report);
  const related = report.targetUserId ? await Report.find({ targetUserId: report.targetUserId }).sort({ createdAt: -1 }).limit(20).lean() : [];
  const safety = report.targetUserId ? await refreshUserSafetyStatus(report.targetUserId.toString()) : undefined;
  adminOk(res, { report, queue, related, safety });
}));
adminRouter.post("/reports/:reportId/assign", requirePermission("reports.resolve"), validateBody(z.object({ adminId: objectIdSchema.optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const report = await Report.findById(req.params.reportId);
  const queue = await ensureQueueForReport(report);
  if (queue) await ModerationQueue.findByIdAndUpdate(queue.id, { assignedTo: req.body.adminId || req.admin!.id, status: "IN_REVIEW" });
  await auditLog({ adminId: req.admin!.id, action: "report.assigned", entityType: "report", entityId: req.params.reportId, metadata: { assignedTo: req.body.adminId || req.admin!.id }, req });
  adminOk(res, { assigned: true });
}));
adminRouter.post("/reports/:reportId/escalate", requirePermission("reports.resolve"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const report = await Report.findById(req.params.reportId);
  const queue = await ensureQueueForReport(report);
  if (queue) await ModerationQueue.findByIdAndUpdate(queue.id, { priority: "CRITICAL", status: "ESCALATED", notes: req.body.reason });
  await createModerationAction(req, "ESCALATED", { reportId: req.params.reportId, queueId: queue?.id, targetType: "REPORT", reason: req.body.reason });
  adminOk(res, { escalated: true });
}));
adminRouter.post("/reports/:reportId/dismiss", requirePermission("reports.resolve"), validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  await Report.findByIdAndUpdate(req.params.reportId, { status: "DISMISSED", reviewedBy: req.admin!.id, reviewedAt: new Date(), moderatorNote: req.body.reason });
  await ModerationQueue.findOneAndUpdate({ reportId: req.params.reportId }, { status: "DISMISSED", resolvedAt: new Date(), resolvedBy: req.admin!.id });
  await createModerationAction(req, "REPORT_DISMISSED", { reportId: req.params.reportId, targetType: "REPORT", reason: req.body.reason });
  adminOk(res, { dismissed: true });
}));
adminRouter.post("/reports/:reportId/resolve", requirePermission("reports.resolve"), validateBody(z.object({ resolution: z.string().min(2).max(80), note: z.string().max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  await Report.findByIdAndUpdate(req.params.reportId, { status: "REVIEWED", reviewedBy: req.admin!.id, reviewedAt: new Date(), moderatorNote: req.body.note });
  await ModerationQueue.findOneAndUpdate({ reportId: req.params.reportId }, { status: "AUTO_RESOLVED", resolvedAt: new Date(), resolvedBy: req.admin!.id });
  await auditLog({ adminId: req.admin!.id, action: "report.resolved", entityType: "report", entityId: req.params.reportId, metadata: req.body, req });
  adminOk(res, { resolved: true });
}));
adminRouter.post("/reports/:reportId/action", requirePermission("reports.resolve"), validateBody(z.object({ action: z.enum(["NO_ACTION", "WARNING", "DELETE_MESSAGE", "HIDE_PROFILE", "REMOVE_PHOTO", "SUSPEND_USER", "BAN_USER", "END_ROOM", "ESCALATE"]), reason: z.string().min(3).max(500), durationHours: z.number().int().min(1).max(8760).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const report: any = await Report.findById(req.params.reportId).lean();
  if (!report) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
  const queue = await ensureQueueForReport(report);
  if (req.body.action === "WARNING" && report.targetUserId) await createNotification(report.targetUserId.toString(), "SYSTEM", "Community warning", req.body.reason, { reportId: req.params.reportId });
  if (req.body.action === "SUSPEND_USER" && report.targetUserId) await User.findByIdAndUpdate(report.targetUserId, { suspendedUntil: new Date(Date.now() + (req.body.durationHours ?? 24) * 60 * 60 * 1000), moderationReason: req.body.reason, $inc: { moderationStrikes: 1 } });
  if (req.body.action === "BAN_USER" && report.targetUserId) await User.findByIdAndUpdate(report.targetUserId, { isBlocked: true, moderationReason: req.body.reason, $inc: { moderationStrikes: 1, tokenVersion: 1 } });
  if (req.body.action === "END_ROOM" && report.roomId) await Room.findByIdAndUpdate(report.roomId, { status: "ENDED", endedAt: new Date() });
  await Report.findByIdAndUpdate(req.params.reportId, { status: req.body.action === "NO_ACTION" ? "DISMISSED" : "ACTION_TAKEN", reviewedBy: req.admin!.id, reviewedAt: new Date(), moderatorNote: req.body.reason });
  await ModerationQueue.findByIdAndUpdate(queue?.id, { status: req.body.action === "NO_ACTION" ? "DISMISSED" : "ACTION_TAKEN", resolvedAt: new Date(), resolvedBy: req.admin!.id });
  const action = await createModerationAction(req, req.body.action === "NO_ACTION" ? "NO_ACTION" : req.body.action === "WARNING" ? "WARNING_SENT" : req.body.action === "SUSPEND_USER" ? "USER_SUSPENDED" : req.body.action === "BAN_USER" ? "USER_BANNED" : req.body.action === "END_ROOM" ? "ROOM_ENDED" : "ESCALATED", { reportId: req.params.reportId, queueId: queue?.id, targetType: report.roomId ? "ROOM" : "USER", targetId: report.roomId ?? report.targetUserId, targetUserId: report.targetUserId, reason: req.body.reason, durationHours: req.body.durationHours });
  if (report.targetUserId) await refreshUserSafetyStatus(report.targetUserId.toString(), req.admin!.id);
  adminOk(res, { action });
}));

adminRouter.get("/moderation/queue", requirePermission("reports.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  const assignedTo = objectIdQuery(req.query.assignedTo, "assignedTo");
  if (assignedTo) filter.assignedTo = assignedTo;
  const [items, total] = await Promise.all([ModerationQueue.find(filter).populate("reportId targetUserId assignedTo").sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), ModerationQueue.countDocuments(filter)]);
  adminOk(res, items, paginationMeta(page, limit, total));
}));
adminRouter.get("/moderation/queue/:queueId", requirePermission("reports.read"), asyncHandler(async (req, res) => adminOk(res, await ModerationQueue.findById(req.params.queueId).populate("reportId targetUserId assignedTo resolvedBy").lean())));
adminRouter.post("/moderation/queue/:queueId/assign", requirePermission("reports.resolve"), validateBody(z.object({ adminId: objectIdSchema.optional() })), asyncHandler(async (req: AdminAuthRequest, res) => adminOk(res, { queue: await ModerationQueue.findByIdAndUpdate(req.params.queueId, { assignedTo: req.body.adminId || req.admin!.id, status: "IN_REVIEW" }, { new: true }) })));
adminRouter.post("/moderation/queue/:queueId/resolve", requirePermission("reports.resolve"), validateBody(z.object({ status: z.enum(["ACTION_TAKEN", "DISMISSED", "AUTO_RESOLVED"]), notes: z.string().max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const queue = await ModerationQueue.findByIdAndUpdate(req.params.queueId, { status: req.body.status, notes: req.body.notes, resolvedAt: new Date(), resolvedBy: req.admin!.id }, { new: true });
  await auditLog({ adminId: req.admin!.id, action: "moderation_queue.resolved", entityType: "moderation_queue", entityId: req.params.queueId, metadata: req.body, req });
  adminOk(res, { queue });
}));
adminRouter.post("/moderation/queue/:queueId/escalate", requirePermission("reports.resolve"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const queue = await ModerationQueue.findByIdAndUpdate(req.params.queueId, { status: "ESCALATED", priority: "CRITICAL", notes: req.body.reason }, { new: true });
  await auditLog({ adminId: req.admin!.id, action: "moderation_queue.escalated", entityType: "moderation_queue", entityId: req.params.queueId, metadata: req.body, req });
  adminOk(res, { queue });
}));

adminRouter.post("/clans/:clanId/clean-messages", requireAnyPermission(["messages.delete", "reports.resolve"]), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { clanId } = req.params;
  if (!isValidObjectId(clanId)) throw new HttpError(400, "Invalid clan ID", ErrorCode.VALIDATION);
  const clan = await Clan.findById(clanId).select("name memberIds").lean();
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  const result = await ClanMessage.deleteMany({ clanId });
  await auditLog({ adminId: req.admin!.id, action: "clan.clean_messages", entityType: "clan", entityId: clanId, metadata: { deletedCount: result.deletedCount }, req });
  adminOk(res, { deletedCount: result.deletedCount });
}));

adminRouter.get("/messages", requirePermission("messages.read"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  const senderId = objectIdQuery(req.query.senderId, "senderId");
  const roomId = objectIdQuery(req.query.roomId, "roomId");
  if (senderId) filter.senderId = senderId;
  if (roomId) filter.roomId = roomId;
  if (req.query.containsKeyword) filter.message = textRegex(req.query.containsKeyword);
  const [messages, total] = await Promise.all([ChatMessage.find(filter).populate("senderId roomId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), ChatMessage.countDocuments(filter)]);
  adminOk(res, messages, paginationMeta(page, limit, total));
}));
adminRouter.get("/messages/:messageId", requirePermission("messages.read"), asyncHandler(async (req, res) => adminOk(res, await ChatMessage.findById(req.params.messageId).populate("senderId roomId").lean())));
adminRouter.post("/messages/:messageId/delete", requirePermission("messages.delete"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const message: any = await ChatMessage.findByIdAndUpdate(req.params.messageId, { message: "[deleted by moderation]", metadata: { deletedByAdmin: req.admin!.id, reason: req.body.reason } }, { new: true }).lean();
  await createModerationAction(req, "MESSAGE_DELETED", { targetType: "MESSAGE", targetId: req.params.messageId, targetUserId: message?.senderId?.toString(), reason: req.body.reason });
  adminOk(res, { message });
}));
adminRouter.post("/messages/:messageId/restore", requirePermission("messages.delete"), asyncHandler(async (req: AdminAuthRequest, res) => {
  await auditLog({ adminId: req.admin!.id, action: "message.restore_requested", entityType: "message", entityId: req.params.messageId, req });
  adminOk(res, { restored: false, note: "Original message bodies are not retained after moderation delete." });
}));
adminRouter.get("/chats/:chatId/messages", requirePermission("messages.read_private"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const ids = req.params.chatId.split(":").filter(isValidObjectId);
  if (ids.length !== 2) throw new HttpError(400, "chatId must be userA:userB", ErrorCode.VALIDATION);
  const messages = await DirectMessage.find({ $or: [{ senderId: ids[0], receiverId: ids[1] }, { senderId: ids[1], receiverId: ids[0] }] }).sort({ createdAt: -1 }).limit(200).lean();
  await auditLog({ adminId: req.admin!.id, action: "private_chat.viewed", entityType: "direct_chat", metadata: { chatId: req.params.chatId, count: messages.length }, req });
  adminOk(res, messages);
}));
adminRouter.post("/chats/:chatId/restrict", requirePermission("messages.delete"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const ids = req.params.chatId.split(":").filter(isValidObjectId);
  await Promise.all(ids.map((id) => flagSafetyState(id, { isChatRestricted: true }, req.admin!.id)));
  await auditLog({ adminId: req.admin!.id, action: "chat.restricted", entityType: "direct_chat", metadata: { chatId: req.params.chatId, reason: req.body.reason }, req });
  adminOk(res, { restricted: true });
}));
adminRouter.post("/chats/:chatId/unrestrict", requirePermission("messages.delete"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const ids = req.params.chatId.split(":").filter(isValidObjectId);
  await Promise.all(ids.map((id) => flagSafetyState(id, { isChatRestricted: false }, req.admin!.id)));
  await auditLog({ adminId: req.admin!.id, action: "chat.unrestricted", entityType: "direct_chat", metadata: { chatId: req.params.chatId }, req });
  adminOk(res, { restricted: false });
}));

adminRouter.get("/wallet/users/:userId", requirePermission("wallet.read"), asyncHandler(async (req, res) => {
  const [user, safety, transactions] = await Promise.all([User.findById(req.params.userId).select("name username walletBalance").lean(), UserSafetyStatus.findOne({ userId: req.params.userId }).lean(), WalletTransaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(50).lean()]);
  adminOk(res, { user, safety, transactions });
}));
adminRouter.get("/wallet/users/:userId/transactions", requirePermission("wallet.read"), asyncHandler(async (req, res) => adminOk(res, await WalletTransaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(200).lean())));
adminRouter.post("/wallet/users/:userId/adjust", requirePermission("wallet.adjust"), validateBody(z.object({ type: z.enum(["CREDIT", "DEBIT"]), amount: z.number().int().min(1).max(100000), reason: z.string().min(3).max(500), metadata: z.record(z.unknown()).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const frozen = await UserSafetyStatus.findOne({ userId: req.params.userId, isWalletFrozen: true }).lean();
  if (frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [tx] = req.body.type === "CREDIT"
      ? await creditWallet(req.params.userId, req.body.amount, "ADMIN_ADJUSTMENT", { reason: req.body.reason, adminId: req.admin!.id, ...(req.body.metadata ?? {}) }, session)
      : await debitWallet(req.params.userId, req.body.amount, "ADMIN_ADJUSTMENT", { reason: req.body.reason, adminId: req.admin!.id, ...(req.body.metadata ?? {}) }, session);
    await session.commitTransaction();
    await auditLog({ adminId: req.admin!.id, action: "wallet.adjusted", entityType: "wallet_transaction", entityId: tx.id, targetUserId: req.params.userId, metadata: { type: req.body.type, amount: req.body.amount, reason: req.body.reason }, req });
    adminOk(res, { transaction: tx }, {}, 201);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}));
adminRouter.post("/wallet/users/:userId/freeze", requirePermission("wallet.adjust"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const safety = await flagSafetyState(req.params.userId, { isWalletFrozen: true }, req.admin!.id);
  await createModerationAction(req, "WALLET_FROZEN", { targetType: "USER", targetId: req.params.userId, targetUserId: req.params.userId, reason: req.body.reason });
  adminOk(res, { safety });
}));
adminRouter.post("/wallet/users/:userId/unfreeze", requirePermission("wallet.adjust"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const safety = await flagSafetyState(req.params.userId, { isWalletFrozen: false }, req.admin!.id);
  await auditLog({ adminId: req.admin!.id, action: "wallet.unfrozen", entityType: "user_safety_status", entityId: safety.id, targetUserId: req.params.userId, req });
  adminOk(res, { safety });
}));
adminRouter.get("/wallet/transactions", requirePermission("wallet.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  const walletUserId = objectIdQuery(req.query.userId, "userId");
  if (walletUserId) filter.userId = walletUserId;
  if (req.query.type) filter.type = req.query.type;
  const [transactions, total] = await Promise.all([WalletTransaction.find(filter).populate("userId", "name username").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), WalletTransaction.countDocuments(filter)]);
  adminOk(res, transactions, paginationMeta(page, limit, total));
}));
adminRouter.get("/wallet/suspicious", requirePermission("wallet.read"), asyncHandler(async (_req, res) => {
  const users = await UserSafetyStatus.find({ $or: [{ isWalletFrozen: true }, { riskLevel: { $in: ["HIGH", "CRITICAL"] } }] }).populate("userId", "name username walletBalance").sort({ trustScore: 1 }).limit(100).lean();
  adminOk(res, users);
}));

adminRouter.get("/payments/recharges", requirePermission("payments.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  if (req.query.platform) filter.provider = req.query.platform;
  if (req.query.status) filter.status = req.query.status;
  const paymentUserId = objectIdQuery(req.query.userId, "userId");
  if (paymentUserId) filter.userId = paymentUserId;
  const [purchases, total] = await Promise.all([Purchase.find(filter).populate("userId", "name username").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Purchase.countDocuments(filter)]);
  adminOk(res, purchases, paginationMeta(page, limit, total));
}));
adminRouter.get("/payments/recharges/:orderId", requirePermission("payments.read"), asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({ $or: [{ _id: isValidObjectId(req.params.orderId) ? req.params.orderId : undefined }, { providerOrderId: req.params.orderId }, { googleOrderId: req.params.orderId }] }).populate("userId", "name username walletBalance").lean();
  adminOk(res, purchase);
}));
adminRouter.post("/payments/recharges/:orderId/verify", requirePermission("payments.read"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const purchase: any = await findPurchaseByReference(req.params.orderId);
  if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
  if (["REFUND_PENDING", "REFUNDED"].includes(purchase.status)) {
    throw new HttpError(409, "Refunded purchases cannot be verified for credit", ErrorCode.CONFLICT);
  }

  let providerRecord: unknown;
  let result = { purchase, transaction: null as unknown };
  if (purchase.provider === "RAZORPAY") {
    if (!purchase.providerPaymentId) {
      throw new HttpError(409, "No Razorpay payment ID is recorded for this purchase yet", ErrorCode.CONFLICT);
    }
    const payment = await fetchRazorpayPayment(purchase.providerPaymentId);
    providerRecord = payment;
    if (payment.order_id !== purchase.providerOrderId || payment.amount !== purchase.amountInr * 100 || payment.currency !== "INR") {
      throw new HttpError(400, "Razorpay payment details do not match purchase", ErrorCode.VALIDATION);
    }
    purchase.metadata = { ...metadataOf(purchase), adminPaymentVerification: payment };
    if (payment.status !== "captured") {
      purchase.status = payment.status === "failed" ? "FAILED" : "PAID";
      await purchase.save();
    } else if (purchase.status !== "CREDITED") {
      result = await creditVerifiedPurchase(purchase.id, req.admin!.id, { paymentId: payment.id, verifiedByAdmin: true });
    } else {
      await purchase.save();
    }
  } else {
    if (!purchase.productId || !purchase.purchaseToken) {
      throw new HttpError(409, "Google Play product ID or purchase token is missing", ErrorCode.CONFLICT);
    }
    const product = await verifyGooglePlayProduct({ productId: purchase.productId, purchaseToken: purchase.purchaseToken });
    providerRecord = product;
    if (product.purchaseState !== 0) {
      purchase.status = "FAILED";
      purchase.metadata = { ...metadataOf(purchase), adminProductVerification: product };
      await purchase.save();
      throw new HttpError(402, "Google Play purchase is not completed", ErrorCode.VALIDATION);
    }
    purchase.googleOrderId = purchase.googleOrderId ?? product.orderId;
    purchase.metadata = { ...metadataOf(purchase), adminProductVerification: product };
    await purchase.save();
    if (purchase.status !== "CREDITED") {
      result = await creditVerifiedPurchase(purchase.id, req.admin!.id, { productId: purchase.productId, googleOrderId: purchase.googleOrderId, verifiedByAdmin: true });
    }
  }

  await auditLog({ adminId: req.admin!.id, action: "payment.verified", entityType: "purchase", entityId: purchase.id, targetUserId: purchase.userId.toString(), metadata: { orderId: req.params.orderId, provider: purchase.provider, providerRecord }, req });
  adminOk(res, { purchase: result.purchase, transaction: result.transaction, providerRecord });
}));
adminRouter.post("/payments/recharges/:orderId/credit", requirePermission("payments.refund"), validateBody(z.object({ reason: z.string().min(3).max(500) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const purchase: any = await findPurchaseByReference(req.params.orderId);
  if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
  if (purchase.status === "CREDITED") return adminOk(res, { purchase });
  if (["REFUND_PENDING", "REFUNDED"].includes(purchase.status)) {
    throw new HttpError(409, "Refunded purchases cannot be manually credited", ErrorCode.CONFLICT);
  }
  const result = await creditVerifiedPurchase(purchase.id, req.admin!.id, { manualCredit: true, reason: req.body.reason });
  await auditLog({ adminId: req.admin!.id, action: "payment.credited", entityType: "purchase", entityId: purchase.id, targetUserId: purchase.userId.toString(), metadata: { reason: req.body.reason }, req });
  adminOk(res, { purchase: result.purchase, transaction: result.transaction });
}));
adminRouter.post("/payments/recharges/:orderId/refund", requirePermission("payments.refund"), validateBody(z.object({ reason: z.string().min(3).max(500) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const purchase: any = await findPurchaseByReference(req.params.orderId);
  if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
  const reserved = await reservePurchaseRefund(purchase.id, req.admin!.id, req.body.reason);
  if (reserved.alreadyRefunded) return adminOk(res, { purchase: reserved.purchase, alreadyRefunded: true });

  try {
    let providerRefund: unknown;
    let finalStatus: "REFUND_PENDING" | "REFUNDED" = "REFUNDED";
    let providerRefundId: string | undefined;
    if (purchase.provider === "RAZORPAY") {
      const paymentId = reserved.purchase.providerPaymentId;
      if (!paymentId) throw new HttpError(409, "No Razorpay payment ID is recorded for this purchase", ErrorCode.CONFLICT);
      const payment = await fetchRazorpayPayment(paymentId);
      if (payment.status !== "captured") {
        throw new HttpError(400, "Only captured Razorpay payments can be refunded", ErrorCode.VALIDATION);
      }
      const refund = await createRazorpayRefund({
        paymentId,
        amountInPaise: reserved.purchase.amountInr * 100,
        receipt: `refund_${reserved.purchase.id}`,
        notes: { purchaseId: reserved.purchase.id, adminId: req.admin!.id, reason: req.body.reason.slice(0, 120) }
      });
      providerRefund = refund;
      providerRefundId = refund.id;
      if (refund.status === "failed") throw new HttpError(502, "Razorpay refund failed", ErrorCode.VALIDATION);
      finalStatus = refund.status === "processed" ? "REFUNDED" : "REFUND_PENDING";
    } else {
      const orderId = reserved.purchase.googleOrderId;
      if (!orderId) throw new HttpError(409, "No Google Play order ID is recorded for this purchase", ErrorCode.CONFLICT);
      providerRefund = await refundGooglePlayOrder({ orderId, revoke: true });
      providerRefundId = orderId;
    }
    const refundedPurchase = await finalizePurchaseRefund(reserved.purchase.id, { status: finalStatus, providerRefundId, providerResponse: providerRefund });
    await auditLog({ adminId: req.admin!.id, action: "payment.refunded", entityType: "purchase", entityId: refundedPurchase.id, targetUserId: refundedPurchase.userId.toString(), metadata: { orderId: req.params.orderId, reason: req.body.reason, providerRefund, localDebitTransactionId: reserved.transaction?._id?.toString?.() }, req });
    adminOk(res, { purchase: refundedPurchase, providerRefund, transaction: reserved.transaction });
  } catch (error) {
    await restoreFailedRefundReservation(reserved.purchase.id, req.admin!.id, req.body.reason, error instanceof Error ? error.message : String(error));
    await auditLog({ adminId: req.admin!.id, action: "payment.refund_failed", entityType: "purchase", entityId: purchase.id, targetUserId: purchase.userId.toString(), metadata: { orderId: req.params.orderId, reason: req.body.reason, error: error instanceof Error ? error.message : String(error) }, req });
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, `Refund failed: ${error instanceof Error ? error.message : "Unknown provider error"}`, ErrorCode.VALIDATION);
  }
}));
adminRouter.get("/payments/revenue-summary", requirePermission("payments.read"), asyncHandler(async (_req, res) => adminOk(res, await Purchase.aggregate([{ $match: { status: "CREDITED" } }, { $group: { _id: "$provider", gross: { $sum: "$amountInr" }, coins: { $sum: "$coinAmount" }, count: { $sum: 1 } } }]))));
adminRouter.get("/payments/failed", requirePermission("payments.read"), asyncHandler(async (_req, res) => adminOk(res, await Purchase.find({ status: "FAILED" }).sort({ createdAt: -1 }).limit(100).lean())));
adminRouter.get("/payments/refunds", requirePermission("payments.read"), asyncHandler(async (_req, res) => adminOk(res, await AdminAuditLog.find({ action: /payment\.refund/ }).sort({ createdAt: -1 }).limit(100).lean())));

adminRouter.get("/earnings", requirePermission("withdrawals.read"), asyncHandler(async (_req, res) => adminOk(res, await GiftTransaction.aggregate([{ $group: { _id: "$receiverId", giftIncome: { $sum: "$coinAmount" }, count: { $sum: 1 } } }, { $sort: { giftIncome: -1 } }, { $limit: 100 }]))));
adminRouter.get("/earnings/users/:userId", requirePermission("withdrawals.read"), asyncHandler(async (req, res) => adminOk(res, await GiftTransaction.find({ receiverId: req.params.userId }).populate("senderId giftId").sort({ createdAt: -1 }).limit(100).lean())));
adminRouter.get("/withdrawals", requirePermission("withdrawals.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter = req.query.status ? { status: String(req.query.status) } : {};
  const [withdrawals, total] = await Promise.all([
    WithdrawalRequest.find(filter).populate("userId", "name username avatar role").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WithdrawalRequest.countDocuments(filter)
  ]);
  adminOk(res, { withdrawals }, paginationMeta(page, limit, total));
}));
adminRouter.get("/withdrawals/:withdrawalId", requirePermission("withdrawals.read"), asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.withdrawalId)) throw new HttpError(400, "Invalid withdrawal ID", ErrorCode.VALIDATION);
  const withdrawal = await WithdrawalRequest.findById(req.params.withdrawalId).populate("userId", "name username avatar role").lean();
  if (!withdrawal) throw new HttpError(404, "Withdrawal not found", ErrorCode.NOT_FOUND);
  const payoutReview = await PayoutReview.findOne({ withdrawalRequestId: req.params.withdrawalId }).lean();
  adminOk(res, { withdrawal, payoutReview });
}));
adminRouter.post("/withdrawals/:withdrawalId/approve", requirePermission("withdrawals.approve"), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (!isValidObjectId(req.params.withdrawalId)) throw new HttpError(400, "Invalid withdrawal ID", ErrorCode.VALIDATION);
  const withdrawal = await WithdrawalRequest.findByIdAndUpdate(req.params.withdrawalId, { status: "APPROVED", approvedAt: new Date(), reviewedByAdminId: req.admin!.id }, { new: true });
  if (!withdrawal) throw new HttpError(404, "Withdrawal not found", ErrorCode.NOT_FOUND);
  await PayoutReview.findOneAndUpdate({ withdrawalRequestId: withdrawal.id }, { status: "APPROVED", reviewedAt: new Date(), reviewedByAdminId: req.admin!.id });
  await auditLog({ adminId: req.admin!.id, action: "withdrawal.approved", entityType: "withdrawal", entityId: withdrawal.id, targetUserId: withdrawal.userId.toString(), req });
  adminOk(res, { withdrawal });
}));
adminRouter.post("/withdrawals/:withdrawalId/reject", requirePermission("withdrawals.reject"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (!isValidObjectId(req.params.withdrawalId)) throw new HttpError(400, "Invalid withdrawal ID", ErrorCode.VALIDATION);
  const withdrawal = await WithdrawalRequest.findByIdAndUpdate(req.params.withdrawalId, { status: "REJECTED", rejectedAt: new Date(), reviewedByAdminId: req.admin!.id, rejectionReason: req.body.reason }, { new: true });
  if (!withdrawal) throw new HttpError(404, "Withdrawal not found", ErrorCode.NOT_FOUND);
  await PayoutReview.findOneAndUpdate({ withdrawalRequestId: withdrawal.id }, { status: "REJECTED", reviewedAt: new Date(), reviewedByAdminId: req.admin!.id, rejectionReason: req.body.reason });
  await auditLog({ adminId: req.admin!.id, action: "withdrawal.rejected", entityType: "withdrawal", entityId: withdrawal.id, targetUserId: withdrawal.userId.toString(), metadata: { reason: req.body.reason }, req });
  adminOk(res, { withdrawal });
}));
adminRouter.post("/withdrawals/:withdrawalId/mark-paid", requirePermission("withdrawals.approve"), asyncHandler(async (req: AdminAuthRequest, res) => {
  if (!isValidObjectId(req.params.withdrawalId)) throw new HttpError(400, "Invalid withdrawal ID", ErrorCode.VALIDATION);
  const withdrawal = await WithdrawalRequest.findOneAndUpdate({ _id: req.params.withdrawalId, status: "APPROVED" }, { status: "PAID", paidAt: new Date(), reviewedByAdminId: req.admin!.id }, { new: true });
  if (!withdrawal) throw new HttpError(404, "Approved withdrawal not found", ErrorCode.NOT_FOUND);
  await auditLog({ adminId: req.admin!.id, action: "withdrawal.marked_paid", entityType: "withdrawal", entityId: withdrawal.id, targetUserId: withdrawal.userId.toString(), req });
  adminOk(res, { withdrawal });
}));
adminRouter.post("/withdrawals/:withdrawalId/request-info", requirePermission("withdrawals.read"), validateBody(reasonSchema), asyncHandler(async (req: AdminAuthRequest, res) => { await auditLog({ adminId: req.admin!.id, action: "withdrawal.info_requested", entityType: "withdrawal", metadata: { withdrawalId: req.params.withdrawalId, reason: req.body.reason }, req }); adminOk(res, { requested: true }); }));

adminRouter.get("/gifts", requirePermission("gifts.manage"), asyncHandler(async (_req, res) => adminOk(res, await Gift.find().sort({ coinPrice: 1 }).lean())));
adminRouter.post("/gifts", requirePermission("gifts.manage"), validateBody(z.object({ name: z.string().min(1).max(80), icon: z.string().min(1).max(500), coinPrice: z.number().int().min(1), isActive: z.boolean().optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const gift = await Gift.create(req.body);
  await auditLog({ adminId: req.admin!.id, action: "gift.created", entityType: "gift", entityId: gift.id, metadata: req.body, req });
  adminOk(res, { gift }, {}, 201);
}));
adminRouter.get("/gifts/:giftId", requirePermission("gifts.manage"), asyncHandler(async (req, res) => adminOk(res, await Gift.findById(req.params.giftId).lean())));
adminRouter.patch("/gifts/:giftId", requirePermission("gifts.manage"), validateBody(z.object({ name: z.string().min(1).max(80).optional(), icon: z.string().min(1).max(500).optional(), coinPrice: z.number().int().min(1).optional(), isActive: z.boolean().optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const before = await Gift.findById(req.params.giftId).lean();
  const gift = await Gift.findByIdAndUpdate(req.params.giftId, req.body, { new: true }).lean();
  await auditLog({ adminId: req.admin!.id, action: "gift.updated", entityType: "gift", entityId: req.params.giftId, metadata: { before, after: gift }, req });
  adminOk(res, { gift });
}));
adminRouter.post("/gifts/:giftId/activate", requirePermission("gifts.manage"), asyncHandler(async (req: AdminAuthRequest, res) => { const gift = await Gift.findByIdAndUpdate(req.params.giftId, { isActive: true }, { new: true }); await auditLog({ adminId: req.admin!.id, action: "gift.activated", entityType: "gift", entityId: req.params.giftId, req }); adminOk(res, { gift }); }));
adminRouter.post("/gifts/:giftId/deactivate", requirePermission("gifts.manage"), asyncHandler(async (req: AdminAuthRequest, res) => { const gift = await Gift.findByIdAndUpdate(req.params.giftId, { isActive: false }, { new: true }); await auditLog({ adminId: req.admin!.id, action: "gift.deactivated", entityType: "gift", entityId: req.params.giftId, req }); adminOk(res, { gift }); }));
adminRouter.delete("/gifts/:giftId", requirePermission("gifts.manage"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const used = await GiftTransaction.exists({ giftId: req.params.giftId });
  const gift = used ? await Gift.findByIdAndUpdate(req.params.giftId, { isActive: false }, { new: true }) : await Gift.findByIdAndDelete(req.params.giftId);
  await auditLog({ adminId: req.admin!.id, action: used ? "gift.soft_deleted" : "gift.deleted", entityType: "gift", entityId: req.params.giftId, req });
  adminOk(res, { gift, softDeleted: Boolean(used) });
}));

const notificationBodySchema = z.object({ title: z.string().min(1).max(120), body: z.string().min(1).max(500), type: z.string().min(1).max(60).default("SYSTEM"), payload: z.record(z.unknown()).optional() });
adminRouter.post("/notifications/send-user", requirePermission("notifications.send"), validateBody(notificationBodySchema.extend({ userId: objectIdSchema })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const notification = await createNotification(req.body.userId, req.body.type, req.body.title, req.body.body, req.body.payload ?? {});
  await auditLog({ adminId: req.admin!.id, action: "notification.sent_user", entityType: "notification", targetUserId: req.body.userId, metadata: req.body, req });
  adminOk(res, { notification });
}));
adminRouter.post("/notifications/send-segment", requirePermission("notifications.send"), validateBody(notificationBodySchema.extend({ segment: z.string().min(1), city: z.string().optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const filter: Record<string, unknown> = req.body.segment === "city" && req.body.city ? { city: req.body.city } : req.body.segment === "hosts" ? { role: "HOST" } : {};
  const users = await User.find(filter).select("_id").limit(1000).lean();
  await Promise.all(users.map((user: any) => createNotification(user._id.toString(), req.body.type, req.body.title, req.body.body, req.body.payload ?? {})));
  await auditLog({ adminId: req.admin!.id, action: "notification.sent_segment", entityType: "notification_campaign", metadata: { ...req.body, count: users.length }, req });
  adminOk(res, { sent: users.length });
}));
adminRouter.post("/notifications/send-all", requirePermission("notifications.send"), validateBody(notificationBodySchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const users = await User.find({ isBlocked: { $ne: true } }).select("_id").limit(5000).lean();
  await Promise.all(users.map((user: any) => createNotification(user._id.toString(), req.body.type, req.body.title, req.body.body, req.body.payload ?? {})));
  await auditLog({ adminId: req.admin!.id, action: "notification.sent_all", entityType: "notification_campaign", metadata: { ...req.body, count: users.length }, req });
  adminOk(res, { sent: users.length });
}));
adminRouter.get("/notifications/campaigns", requirePermission("notifications.send"), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const skip = (page - 1) * limit;
  const [campaigns, total] = await Promise.all([
    NotificationCampaign.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("createdBy", "displayName").lean(),
    NotificationCampaign.countDocuments()
  ]);
  adminOk(res, { campaigns }, paginationMeta(page, limit, total));
}));
adminRouter.get("/notifications/campaigns/:id", requirePermission("notifications.send"), asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id).populate("createdBy", "displayName").lean();
  if (!campaign) throw new HttpError(404, "Campaign not found", ErrorCode.NOT_FOUND);
  adminOk(res, { campaign });
}));
adminRouter.post("/notifications/campaigns", requirePermission("notifications.send"), validateBody(z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  segment: z.enum(["all", "hosts", "city", "vip", "custom"]),
  segmentValue: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  scheduledFor: z.coerce.date().optional()
})), asyncHandler(async (req: AdminAuthRequest, res) => {
  const campaign = await NotificationCampaign.create({ ...req.body, createdBy: req.admin!._id });
  await auditLog({ adminId: req.admin!.id, action: "notification.campaign.created", entityType: "notification_campaign", entityId: campaign.id, metadata: req.body, req });
  adminOk(res, { campaign }, {}, 201);
}));
adminRouter.post("/notifications/campaigns/:id/send", requirePermission("notifications.send"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) throw new HttpError(404, "Campaign not found", ErrorCode.NOT_FOUND);
  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") throw new HttpError(400, "Campaign already sent", ErrorCode.VALIDATION);

  const filter: Record<string, unknown> = {};
  if (campaign.segment === "hosts") filter.role = "HOST";
  else if (campaign.segment === "city") filter.city = campaign.segmentValue;
  else if (campaign.segment === "vip") filter.vipTier = { $ne: null };
  else if (campaign.segment === "custom" && campaign.filters) Object.assign(filter, campaign.filters);
  if (campaign.segment !== "all") filter.isBlocked = { $ne: true };

  const users = await User.find(filter).select("_id").limit(10000).lean();
  campaign.status = "SENDING";
  campaign.sentCount = users.length;
  await campaign.save();

  let delivered = 0;
  for (const user of users) {
    try {
      await createNotification(user._id.toString(), "SYSTEM", campaign.title, campaign.body, { campaignId: campaign.id });
      delivered++;
    } catch { /* skip failed deliveries */ }
  }

  campaign.status = "SENT";
  campaign.deliveredCount = delivered;
  campaign.sentAt = new Date();
  campaign.completedAt = new Date();
  await campaign.save();

  await auditLog({ adminId: req.admin!.id, action: "notification.campaign.sent", entityType: "notification_campaign", entityId: campaign.id, metadata: { segment: campaign.segment, count: users.length, delivered }, req });
  adminOk(res, { sent: users.length, delivered });
}));
adminRouter.post("/notifications/campaigns/:id/cancel", requirePermission("notifications.send"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) throw new HttpError(404, "Campaign not found", ErrorCode.NOT_FOUND);
  if (campaign.status === "SENT") throw new HttpError(400, "Cannot cancel a sent campaign", ErrorCode.VALIDATION);
  campaign.status = "CANCELLED";
  await campaign.save();
  adminOk(res, { campaign });
}));

// Support ticket management moved to adminSupport.ts

for (const key of ["users", "rooms", "matches", "messages", "wallet", "gifts", "reports", "retention", "revenue"] as const) {
  adminRouter.get(`/analytics/${key}`, requirePermission("analytics.read"), asyncHandler(async (req, res) => {
    const from = queryDate(req.query.from) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = queryDate(req.query.to) ?? new Date();
    const createdFilter = { createdAt: { $gte: from, $lte: to } };
    const data = key === "users" ? await User.countDocuments(createdFilter)
      : key === "rooms" ? await Room.countDocuments(createdFilter)
      : key === "messages" ? await ChatMessage.countDocuments(createdFilter)
      : key === "wallet" ? await WalletTransaction.aggregate([{ $match: createdFilter }, { $group: { _id: "$type", amount: { $sum: "$amount" }, count: { $sum: 1 } } }])
      : key === "gifts" ? await GiftTransaction.aggregate([{ $match: createdFilter }, { $group: { _id: null, amount: { $sum: "$coinAmount" }, count: { $sum: 1 } } }])
      : key === "reports" ? await Report.countDocuments(createdFilter)
      : key === "revenue" ? await Purchase.aggregate([{ $match: { ...createdFilter, status: "CREDITED" } }, { $group: { _id: "$provider", gross: { $sum: "$amountInr" }, count: { $sum: 1 } } }])
      : [];
    adminOk(res, { metric: key, from, to, data });
  }));
}

adminRouter.get("/fraud/suspicious-users", requirePermission("analytics.read"), asyncHandler(async (_req, res) => adminOk(res, await UserSafetyStatus.find({ riskLevel: { $in: ["HIGH", "CRITICAL"] } }).populate("userId", "name username avatar").sort({ trustScore: 1 }).limit(100).lean())));
adminRouter.get("/fraud/suspicious-wallets", requirePermission("wallet.read"), asyncHandler(async (_req, res) => adminOk(res, await UserSafetyStatus.find({ $or: [{ isWalletFrozen: true }, { riskLevel: "CRITICAL" }] }).populate("userId", "name username walletBalance").sort({ trustScore: 1 }).limit(100).lean())));
adminRouter.get("/fraud/suspicious-rooms", requirePermission("rooms.read"), asyncHandler(async (_req, res) => adminOk(res, await Room.find({ status: "LIVE", participantCount: { $gte: 50 } }).populate("hostId", "name username").sort({ participantCount: -1 }).limit(100).lean())));
adminRouter.post("/fraud/users/:userId/review", requirePermission("reports.resolve"), validateBody(z.object({ notes: z.string().max(1000).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const safety = await refreshUserSafetyStatus(req.params.userId, req.admin!.id);
  await auditLog({ adminId: req.admin!.id, action: "fraud.user_reviewed", entityType: "user_safety_status", entityId: safety.id, targetUserId: req.params.userId, metadata: { notes: req.body.notes }, req });
  adminOk(res, { safety });
}));

adminRouter.get("/config", requirePermission("settings.manage"), asyncHandler(async (_req, res) => adminOk(res, await AppConfig.find().sort({ key: 1 }).lean())));
adminRouter.get("/config/:key", requirePermission("settings.manage"), asyncHandler(async (req, res) => adminOk(res, await AppConfig.findOne({ key: req.params.key }).lean())));
adminRouter.put("/config/:key", requirePermission("settings.manage"), validateBody(z.object({ value: z.unknown(), description: z.string().max(500).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const before = await AppConfig.findOne({ key: req.params.key }).lean();
  const config = await AppConfig.findOneAndUpdate({ key: req.params.key }, { value: req.body.value, description: req.body.description, updatedBy: req.admin!.id }, { upsert: true, new: true });
  await auditLog({ adminId: req.admin!.id, action: "config.changed", entityType: "app_config", entityId: config.id, metadata: { before, after: config }, req });
  adminOk(res, { config });
}));
adminRouter.delete("/config/:key", requirePermission("settings.manage"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const config = await AppConfig.findOneAndDelete({ key: req.params.key });
  await auditLog({ adminId: req.admin!.id, action: "config.deleted", entityType: "app_config", entityId: config?.id, metadata: { key: req.params.key }, req });
  adminOk(res, { deleted: Boolean(config) });
}));

adminRouter.get("/audit-logs", requirePermission("audit.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const filter: Record<string, unknown> = {};
  const adminId = objectIdQuery(req.query.adminId, "adminId");
  const targetUserId = objectIdQuery(req.query.targetUserId, "targetUserId");
  if (adminId) filter.adminId = adminId;
  if (req.query.action) filter.action = textRegex(req.query.action);
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (targetUserId) filter.targetUserId = targetUserId;
  const [logs, total] = await Promise.all([AdminAuditLog.find(filter).populate("adminId", "email displayName role").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AdminAuditLog.countDocuments(filter)]);
  adminOk(res, logs, paginationMeta(page, limit, total));
}));

adminRouter.get("/admin-users", requirePermission("settings.manage"), asyncHandler(async (_req, res) => adminOk(res, (await AdminUser.find().sort({ createdAt: -1 }).lean()).map(adminPublic))));
adminRouter.post("/admin-users", requireSuperAdmin, validateBody(adminUserSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const admin = await AdminUser.create({ ...req.body, passwordHash: req.body.password ? await bcrypt.hash(req.body.password, 12) : undefined, isSuperAdmin: req.body.role === "SUPER_ADMIN", createdBy: req.admin!.id });
  await auditLog({ adminId: req.admin!.id, action: "admin_user.created", entityType: "admin_user", entityId: admin.id, metadata: adminPublic(admin), req });
  adminOk(res, { admin: adminPublic(admin) }, {}, 201);
}));
adminRouter.patch("/admin-users/:adminId", requireSuperAdmin, validateBody(z.object({ displayName: z.string().min(2).max(120).optional(), role: z.enum(adminRoles).optional(), status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED", "INVITED"]).optional(), permissions: z.array(z.enum(adminPermissions)).optional() })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const admin = await AdminUser.findByIdAndUpdate(req.params.adminId, req.body, { new: true });
  await auditLog({ adminId: req.admin!.id, action: "admin_user.updated", entityType: "admin_user", entityId: req.params.adminId, metadata: req.body, req });
  adminOk(res, { admin: adminPublic(admin) });
}));
