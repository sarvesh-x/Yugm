import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { Subscription } from "../models/Subscription.js";
import { syncGooglePlaySubscription, verifyGooglePlaySubscription } from "./googlePlaySubscriptions.js";

type GoogleCert = { kid: string; n: string; e: string; alg?: string };
let cachedCerts: { keys: GoogleCert[]; fetchedAt: number } | undefined;

async function getGoogleCerts() {
  if (cachedCerts && Date.now() - cachedCerts.fetchedAt < 60 * 60 * 1000) return cachedCerts.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw new Error(`Failed to fetch Google certs (${response.status})`);
  const json = await response.json() as { keys?: GoogleCert[] };
  cachedCerts = { keys: json.keys ?? [], fetchedAt: Date.now() };
  return cachedCerts.keys;
}

function decodeJsonPart(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf-8")) as Record<string, unknown>;
}

export async function verifyGooglePubSubToken(authorization: string | undefined) {
  if (!env.GOOGLE_PLAY_PUBSUB_AUDIENCE) return { ok: false as const, reason: "audience_not_configured" };
  if (!authorization?.startsWith("Bearer ")) return { ok: false as const, reason: "missing_token" };

  const token = authorization.slice("Bearer ".length);
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "malformed_token" };

  try {
    const header = decodeJsonPart(parts[0]);
    const payload = decodeJsonPart(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") {
      return { ok: false as const, reason: "unsupported_algorithm" };
    }

    const certs = await getGoogleCerts();
    const cert = certs.find((item) => item.kid === header.kid);
    if (!cert) return { ok: false as const, reason: "unknown_key" };

    const publicKey = crypto.createPublicKey({
      key: { kty: "RSA", n: cert.n, e: cert.e },
      format: "jwk"
    });
    const valid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      Buffer.from(parts[2], "base64url")
    );
    if (!valid) return { ok: false as const, reason: "invalid_signature" };

    const now = Math.floor(Date.now() / 1000);
    const iss = payload.iss;
    if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") {
      return { ok: false as const, reason: "invalid_issuer" };
    }
    if (payload.aud !== env.GOOGLE_PLAY_PUBSUB_AUDIENCE) {
      return { ok: false as const, reason: "invalid_audience" };
    }
    if (typeof payload.exp !== "number" || payload.exp <= now) {
      return { ok: false as const, reason: "expired_token" };
    }
    if (env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT && payload.email !== env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT) {
      return { ok: false as const, reason: "invalid_service_account" };
    }

    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, reason: "verification_failed" };
  }
}

export type GooglePlayNotification = {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  testNotification?: { version?: string };
};

export function parseGooglePlayNotification(rawBody: string) {
  const body = JSON.parse(rawBody) as { message?: { data?: string } };
  if (!body.message?.data) throw new Error("Missing Pub/Sub message data");
  const decoded = Buffer.from(body.message.data, "base64").toString("utf-8");
  return JSON.parse(decoded) as GooglePlayNotification;
}

export async function handleGooglePlayWebhook(req: Request, res: Response) {
  const verification = await verifyGooglePubSubToken(req.headers.authorization);
  if (!verification.ok) {
    const status = verification.reason === "audience_not_configured" ? 501 : 401;
    return res.status(status).json({ ok: false, error: verification.reason });
  }

  const rawBody = req.body instanceof Buffer ? req.body.toString("utf-8") : JSON.stringify(req.body);
  let notification: GooglePlayNotification;
  try {
    notification = parseGooglePlayNotification(rawBody);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid Pub/Sub body" });
  }

  if (notification.testNotification) {
    return res.json({ ok: true, test: true });
  }
  if (notification.packageName && env.GOOGLE_PLAY_PACKAGE_NAME && notification.packageName !== env.GOOGLE_PLAY_PACKAGE_NAME) {
    return res.json({ ok: true, ignored: "package_mismatch" });
  }

  const purchaseToken = notification.subscriptionNotification?.purchaseToken;
  if (!purchaseToken) {
    return res.json({ ok: true, ignored: "no_purchase_token" });
  }

  const subscription = await Subscription.findOne({ provider: "GOOGLE_PLAY", providerPurchaseToken: purchaseToken }).lean();
  if (!subscription) {
    console.warn(`[googlePlayWebhook] No subscription matched token from notification type ${notification.subscriptionNotification?.notificationType ?? "unknown"}`);
    return res.json({ ok: true, matched: false });
  }

  let purchase;
  try {
    purchase = await verifyGooglePlaySubscription(purchaseToken);
  } catch (error) {
    console.warn("[googlePlayWebhook] Verification failed:", error instanceof Error ? error.message : String(error));
    const notificationType = notification.subscriptionNotification?.notificationType;
    if (notificationType === 12 || notificationType === 13) {
      await Subscription.updateOne(
        { _id: subscription._id, active: true },
        { $set: { active: false, status: notificationType === 12 ? "CANCELLED" : "EXPIRED" } }
      );
      return res.json({ ok: true, deactivated: true });
    }
    return res.status(502).json({ ok: false, error: "Verification failed" });
  }

  const result = await syncGooglePlaySubscription({
    subscriptionId: subscription._id.toString(),
    purchaseToken,
    purchase
  });

  if (!result.matched) {
    console.warn("[googlePlayWebhook] Verified purchase had an unknown product");
    return res.json({ ok: true, matched: false });
  }

  return res.json({
    ok: true,
    notificationType: notification.subscriptionNotification?.notificationType,
    credited: result.credited,
    status: result.subscription.status
  });
}
