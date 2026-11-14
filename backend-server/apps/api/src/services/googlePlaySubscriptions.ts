import mongoose from "mongoose";
import { findSubscriptionPlanByGoogleProductId, type SubscriptionPlan } from "@yugm/shared";
import { env } from "../config/env.js";
import { Subscription, type SubscriptionStatus } from "../models/Subscription.js";
import { getGoogleAccessToken } from "./payments.js";
import { creditWallet, creatorShare, platformFee } from "./wallet.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export type GooglePlaySubscriptionLineItem = {
  productId?: string;
  expiryTime?: string;
  autoRenewingPlan?: { autoRenewEnabled?: boolean };
  offerDetails?: { basePlanId?: string; offerId?: string };
};

export type GooglePlaySubscriptionPurchase = {
  kind?: string;
  startTime?: string;
  expiryTime?: string;
  autoRenewing?: boolean;
  priceCurrencyCode?: string;
  priceAmountMicros?: string;
  countryCode?: string;
  paymentState?: number;
  cancelReason?: number;
  subscriptionState?: string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  acknowledgementState?: number;
  lineItems?: GooglePlaySubscriptionLineItem[];
};

function requireGooglePlaySubscriptions() {
  if (!env.GOOGLE_PLAY_SUBS_ENABLED) {
    throw new HttpError(503, "Google Play subscriptions are not enabled", ErrorCode.VALIDATION);
  }
  if (!env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new HttpError(503, "Google Play package name is not configured", ErrorCode.VALIDATION);
  }
}

function subscriptionUrl(path: string) {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}${path}`;
}

export async function verifyGooglePlaySubscription(purchaseToken: string) {
  requireGooglePlaySubscriptions();
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(subscriptionUrl(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, json?.error?.message ?? "Google Play subscription verification failed", ErrorCode.VALIDATION);
  }
  return json as GooglePlaySubscriptionPurchase;
}

export async function acknowledgeGooglePlaySubscription(input: { productId: string; purchaseToken: string }) {
  requireGooglePlaySubscriptions();
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    subscriptionUrl(`/purchases/subscriptions/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: "{}"
    }
  );
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new HttpError(response.status, json?.error?.message ?? "Google Play subscription acknowledgement failed", ErrorCode.VALIDATION);
  }
}

export async function cancelGooglePlaySubscription(input: { productId: string; purchaseToken: string }) {
  requireGooglePlaySubscriptions();
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    subscriptionUrl(`/purchases/subscriptions/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:cancel`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: "{}"
    }
  );
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new HttpError(response.status, json?.error?.message ?? "Google Play subscription cancellation failed", ErrorCode.VALIDATION);
  }
}

const statusByState: Record<string, SubscriptionStatus> = {
  SUBSCRIPTION_STATE_ACTIVE: "ACTIVE",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "IN_GRACE_PERIOD",
  SUBSCRIPTION_STATE_CANCELED: "CANCELLED",
  SUBSCRIPTION_STATE_EXPIRED: "EXPIRED",
  SUBSCRIPTION_STATE_ON_HOLD: "ON_HOLD",
  SUBSCRIPTION_STATE_PAUSED: "ON_HOLD",
  SUBSCRIPTION_STATE_PENDING: "PENDING"
};

export function findSubscriptionPlan(productId: string | undefined) {
  if (!productId) return undefined;
  return findSubscriptionPlanByGoogleProductId(productId) as SubscriptionPlan | undefined;
}

export function classifyGooglePlaySubscription(purchase: GooglePlaySubscriptionPurchase) {
  const state = purchase.subscriptionState;
  const status: SubscriptionStatus = state
    ? statusByState[state] ?? "CANCELLED"
    : purchase.autoRenewing ? "ACTIVE" : "CANCELLED";
  const active = status === "ACTIVE" || status === "IN_GRACE_PERIOD";
  return {
    status,
    active,
    periodEnd: purchase.expiryTime ? new Date(purchase.expiryTime) : null,
    paymentReceived: purchase.paymentState === 2,
    autoRenewing: Boolean(purchase.autoRenewing),
    productId: purchase.lineItems?.[0]?.productId,
    basePlanId: purchase.lineItems?.[0]?.offerDetails?.basePlanId
  };
}

export function subscriptionPlanMatchesPurchase(plan: SubscriptionPlan, purchase: GooglePlaySubscriptionPurchase) {
  const classification = classifyGooglePlaySubscription(purchase);
  if (classification.productId !== plan.googleProductId) return false;
  if (classification.basePlanId && classification.basePlanId !== plan.basePlanId) return false;
  return true;
}

export async function applyGooglePlaySubscription(input: {
  subscriptionId: string;
  purchaseToken: string;
  purchase: GooglePlaySubscriptionPurchase;
  plan: SubscriptionPlan;
}) {
  const { subscriptionId, purchaseToken, purchase, plan } = input;
  const classification = classifyGooglePlaySubscription(purchase);
  if (!classification.periodEnd) {
    throw new HttpError(400, "Google Play subscription is missing an expiry time", ErrorCode.VALIDATION);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const subscription = await Subscription.findById(subscriptionId).session(session);
    if (!subscription) throw new HttpError(404, "Subscription not found", ErrorCode.NOT_FOUND);

    const periodEnd = classification.periodEnd;
    const priorCredited = subscription.lastCreditedExpiry?.getTime() ?? 0;
    const shouldCredit = classification.paymentReceived && periodEnd.getTime() > priorCredited && periodEnd.getTime() > Date.now();
    let creatorCredit = 0;

    subscription.provider = "GOOGLE_PLAY";
    subscription.providerPurchaseToken = purchaseToken;
    subscription.providerOrderId = purchase.latestOrderId;
    subscription.plan = plan.id;
    subscription.coinAmount = plan.coinPrice;
    subscription.autoRenewing = classification.autoRenewing;
    subscription.status = classification.status;
    subscription.active = classification.active;
    subscription.expiresAt = periodEnd;
    subscription.lastVerifiedAt = new Date();

    if (shouldCredit) {
      creatorCredit = creatorShare(plan.coinPrice);
      await creditWallet(subscription.creatorId.toString(), creatorCredit, "SUBSCRIPTION", {
        subscriptionId: subscription.id,
        subscriberId: subscription.subscriberId.toString(),
        plan: plan.id,
        provider: "GOOGLE_PLAY",
        purchaseToken,
        platformFee: platformFee(plan.coinPrice)
      }, session);
      subscription.creatorCoinAmount = creatorCredit;
      subscription.platformFeeCoins = platformFee(plan.coinPrice);
      subscription.lastCreditedExpiry = periodEnd;
      subscription.renewalCount = (subscription.renewalCount ?? 0) + 1;
    }

    await subscription.save({ session });
    await session.commitTransaction();
    return { subscription, credited: shouldCredit, creatorCredit };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function syncGooglePlaySubscription(input: {
  subscriptionId: string;
  purchaseToken: string;
  purchase: GooglePlaySubscriptionPurchase;
}) {
  const plan = findSubscriptionPlan(input.purchase.lineItems?.[0]?.productId);
  if (!plan) return { matched: false as const, reason: "unknown_product" };
  const applied = await applyGooglePlaySubscription({ ...input, plan });
  return { matched: true as const, ...applied, plan };
}

export async function expireStaleSubscriptions() {
  const result = await Subscription.updateMany(
    { active: true, expiresAt: { $lte: new Date() } },
    { $set: { active: false, status: "EXPIRED" } }
  );
  return result.modifiedCount;
}

export async function reconcileGooglePlaySubscriptions(limit = 50) {
  if (!env.GOOGLE_PLAY_SUBS_ENABLED) return { scanned: 0, synced: 0, failed: 0 };
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const subscriptions = await Subscription.find({
    provider: "GOOGLE_PLAY",
    providerPurchaseToken: { $exists: true, $ne: null },
    status: { $in: ["ACTIVE", "IN_GRACE_PERIOD", "ON_HOLD", "PENDING", "CANCELLED", "EXPIRED"] },
    expiresAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    $or: [{ lastVerifiedAt: { $exists: false } }, { lastVerifiedAt: { $lte: cutoff } }]
  }).limit(limit);

  let synced = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    try {
      const purchase = await verifyGooglePlaySubscription(subscription.providerPurchaseToken!);
      const result = await syncGooglePlaySubscription({
        subscriptionId: subscription.id,
        purchaseToken: subscription.providerPurchaseToken!,
        purchase
      });
      if (result.matched) synced += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `[reconciliation] Google Play subscription ${subscription.id} verification failed:`,
        error instanceof Error ? error.message : String(error)
      );
      if (subscription.expiresAt.getTime() <= Date.now() && subscription.active) {
        await Subscription.updateOne(
          { _id: subscription._id, active: true },
          { $set: { active: false, status: "EXPIRED" } }
        );
      }
    }
  }

  return { scanned: subscriptions.length, synced, failed };
}
