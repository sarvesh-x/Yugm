import crypto from "crypto";
import { env } from "../config/env.js";
import { HttpError, ErrorCode } from "../utils/http.js";

function requireRazorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new HttpError(503, "Razorpay is not configured", ErrorCode.VALIDATION);
  }
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
}

function razorpayAuthHeader() {
  const { keyId, keySecret } = requireRazorpay();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function createRazorpayOrder(input: { amountInPaise: number; receipt: string; notes?: Record<string, string> }) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, json?.error?.description ?? "Failed to create Razorpay order", ErrorCode.VALIDATION);
  }
  return json as { id: string; amount: number; currency: "INR"; status: string };
}

export function verifyRazorpaySignature(input: { orderId: string; paymentId: string; signature: string }) {
  const { keySecret } = requireRazorpay();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  if (expected.length !== input.signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
}

export async function fetchRazorpayPayment(paymentId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: razorpayAuthHeader() }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, json?.error?.description ?? "Failed to verify Razorpay payment", ErrorCode.VALIDATION);
  }
  return json as { id: string; order_id: string; status: string; amount: number; currency: string };
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: input.amountInPaise,
      speed: "normal",
      receipt: input.receipt,
      notes: input.notes
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, json?.error?.description ?? "Failed to create Razorpay refund", ErrorCode.VALIDATION);
  }
  return json as { id: string; payment_id: string; amount: number; currency: string; status: "pending" | "processed" | "failed" | string };
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken() {
  if (!env.GOOGLE_PLAY_CLIENT_EMAIL || !env.GOOGLE_PLAY_PRIVATE_KEY) {
    throw new HttpError(503, "Google Play verification is not configured", ErrorCode.VALIDATION);
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: env.GOOGLE_PLAY_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  }));
  const unsigned = `${header}.${claim}`;
  const privateKey = env.GOOGLE_PLAY_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, json?.error_description ?? "Failed to authenticate Google Play", ErrorCode.VALIDATION);
  }
  return json.access_token as string;
}

export async function verifyGooglePlayProduct(input: { productId: string; purchaseToken: string }) {
  if (!env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new HttpError(503, "Google Play package name is not configured", ErrorCode.VALIDATION);
  }
  const accessToken = await getGoogleAccessToken();
  const url = new URL(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, json?.error?.message ?? "Google Play purchase verification failed", ErrorCode.VALIDATION);
  }
  return json as { purchaseState?: number; consumptionState?: number; orderId?: string; acknowledgementState?: number };
}

export async function consumeGooglePlayProduct(input: { productId: string; purchaseToken: string }) {
  if (!env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new HttpError(503, "Google Play package name is not configured", ErrorCode.VALIDATION);
  }
  const accessToken = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:consume`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new HttpError(response.status, json?.error?.message ?? "Google Play purchase consumption failed", ErrorCode.VALIDATION);
  }
}

export async function refundGooglePlayOrder(input: { orderId: string; revoke?: boolean }) {
  if (!env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new HttpError(503, "Google Play package name is not configured", ErrorCode.VALIDATION);
  }
  const accessToken = await getGoogleAccessToken();
  const url = new URL(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/orders/${encodeURIComponent(input.orderId)}:refund`);
  if (input.revoke !== undefined) url.searchParams.set("revoke", String(input.revoke));
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new HttpError(response.status, json?.error?.message ?? "Google Play order refund failed", ErrorCode.VALIDATION);
  }
  return { orderId: input.orderId, revoked: input.revoke ?? false };
}
