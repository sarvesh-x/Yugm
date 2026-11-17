import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ImmersiveTheme } from "../models/ImmersiveTheme.js";
import { User } from "../models/User.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { debitWallet } from "./wallet.js";

async function availableTheme(themeKey: string, session?: mongoose.ClientSession) {
  const query = ImmersiveTheme.findOne({ key: themeKey, available: true });
  if (session) query.session(session);
  const theme = await query.lean();
  if (!theme) throw new HttpError(404, "Theme not found", ErrorCode.NOT_FOUND);
  return theme;
}

export function isFreeTheme(theme: { price: { coins: number; diamonds: number } }) {
  return theme.price.coins === 0 && theme.price.diamonds === 0;
}

export async function assertThemeEntitlement(userId: string, themeKey: string) {
  const theme = await availableTheme(themeKey);
  if (isFreeTheme(theme)) return theme;
  const owner = await User.exists({ _id: userId, ownedCosmeticIds: theme.key });
  if (!owner) throw new HttpError(403, "Purchase this theme before using it", ErrorCode.FORBIDDEN);
  return theme;
}

export async function purchaseTheme(userId: string, themeKey: string) {
  const operationId = randomUUID();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const theme = await availableTheme(themeKey, session);
      if (!Number.isSafeInteger(theme.price.coins) || theme.price.coins < 0) {
        throw new HttpError(400, "This theme has an invalid price", ErrorCode.VALIDATION);
      }
      if (theme.price.coins === 0 && !isFreeTheme(theme)) {
        throw new HttpError(409, "This theme cannot be purchased with coins", ErrorCode.CONFLICT);
      }

      // Grant and payment share one transaction. The conditional ownership
      // write serializes repeated/concurrent purchases before charging coins.
      const granted = await User.findOneAndUpdate(
        { _id: userId, ownedCosmeticIds: { $ne: theme.key } },
        { $addToSet: { ownedCosmeticIds: theme.key } },
        { new: true, session }
      );
      if (!granted) {
        const user = await User.findById(userId).session(session).lean();
        if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
        return { theme, alreadyOwned: true };
      }
      if (theme.price.coins > 0) {
        await debitWallet(userId, theme.price.coins, "PROFILE_COSMETIC_PURCHASE", {
          cosmeticId: theme.key,
          idempotencyKey: `theme-purchase:${userId}:${operationId}:debit`
        }, session);
      }
      return { theme, alreadyOwned: false };
    });
  } finally {
    await session.endSession();
  }
}
