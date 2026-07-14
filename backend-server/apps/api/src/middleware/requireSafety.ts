import type { NextFunction, Response } from "express";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { HttpError } from "../utils/http.js";
import type { AuthRequest } from "./auth.js";

export async function requireNotShadowBanned(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new HttpError(401, "Missing user"));
    const status = await UserSafetyStatus.findOne({ userId: req.user.id }).lean();
    if (status?.isShadowBanned) {
      return next(new HttpError(403, "Account restricted"));
    }
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(500, "Safety check failed"));
  }
}

export async function requireNotChatRestricted(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new HttpError(401, "Missing user"));
    const status = await UserSafetyStatus.findOne({ userId: req.user.id }).lean();
    if (status?.isChatRestricted) {
      return next(new HttpError(403, "Chat access restricted"));
    }
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(500, "Safety check failed"));
  }
}

export async function requireNotRoomRestricted(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new HttpError(401, "Missing user"));
    const status = await UserSafetyStatus.findOne({ userId: req.user.id }).lean();
    if (status?.isRoomRestricted) {
      return next(new HttpError(403, "Room access restricted"));
    }
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(500, "Safety check failed"));
  }
}

export async function requireWalletNotFrozen(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new HttpError(401, "Missing user"));
    const status = await UserSafetyStatus.findOne({ userId: req.user.id }).lean();
    if (status?.isWalletFrozen) {
      return next(new HttpError(403, "Wallet is frozen"));
    }
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(500, "Safety check failed"));
  }
}
