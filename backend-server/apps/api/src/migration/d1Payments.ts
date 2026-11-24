import { ErrorCode, HttpError } from "../utils/http.js";

export interface D1PaymentConfig {
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  googlePlayPackageName?: string;
  googlePlayClientEmail?: string;
  googlePlayPrivateKey?: string;
  production: boolean;
}

export interface D1RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  [key: string]: unknown;
}

export interface D1RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  [key: string]: unknown;
}

export interface D1GooglePlayProduct {
  purchaseState?: number;
  consumptionState?: number;
  orderId?: string;
  acknowledgementState?: number;
  [key: string]: unknown;
}

export interface D1PaymentProviders {
  razorpayKeyId(): string;
  assertRazorpayConfigured(): void;
  createRazorpayOrder(input: { amountInPaise: number; receipt: string; notes?: Record<string, string> }): Promise<D1RazorpayOrder>;
  verifyRazorpaySignature(input: { orderId: string; paymentId: string; signature: string }): Promise<boolean>;
  fetchRazorpayPayment(paymentId: string): Promise<D1RazorpayPayment>;
  verifyGooglePlayProduct(input: { productId: string; purchaseToken: string }): Promise<D1GooglePlayProduct>;
  consumeGooglePlayProduct(input: { productId: string; purchaseToken: string }): Promise<void>;
}

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlText(value: string) {
  return base64Url(encoder.encode(value));
}

function pemToDer(pem: string) {
  const body = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function timingSafeHexEqual(expected: string, actual: string) {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function providerError(status: number, message: string): never {
  throw new HttpError(status, message, ErrorCode.VALIDATION);
}

/** Host-neutral Razorpay/Google Play clients for the D1 Worker runtime. */
export function createD1PaymentProviders(config: D1PaymentConfig): D1PaymentProviders {
  function requireRazorpay() {
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      providerError(503, "Razorpay is not configured");
    }
    if (!config.production && config.razorpayKeyId.startsWith("rzp_live_")) {
      providerError(503, "Development checkout only accepts Razorpay test keys");
    }
    return { keyId: config.razorpayKeyId, keySecret: config.razorpayKeySecret };
  }

  function razorpayAuthHeader() {
    const { keyId, keySecret } = requireRazorpay();
    return `Basic ${bytesToBase64(encoder.encode(`${keyId}:${keySecret}`))}`;
  }

  async function googleAccessToken() {
    if (!config.googlePlayClientEmail || !config.googlePlayPrivateKey) {
      providerError(503, "Google Play verification is not configured");
    }
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = base64UrlText(JSON.stringify({
      iss: config.googlePlayClientEmail,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    }));
    const unsigned = `${header}.${claim}`;
    const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("pkcs8", pemToDer(config.googlePlayPrivateKey), algorithm, false, ["sign"]);
    const signature = await crypto.subtle.sign(algorithm, key, encoder.encode(unsigned));
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}`
      })
    });
    const json = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string };
    if (!response.ok || !json.access_token) {
      providerError(response.status, json.error_description ?? "Failed to authenticate Google Play");
    }
    return json.access_token;
  }

  function requirePackageName() {
    if (!config.googlePlayPackageName) providerError(503, "Google Play package name is not configured");
    return config.googlePlayPackageName;
  }

  return {
    razorpayKeyId() {
      return requireRazorpay().keyId;
    },
    assertRazorpayConfigured() {
      requireRazorpay();
    },
    async createRazorpayOrder(input) {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: razorpayAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: input.amountInPaise,
          currency: "INR",
          receipt: input.receipt,
          notes: input.notes
        })
      });
      const json = await response.json().catch(() => ({})) as D1RazorpayOrder & { error?: { description?: string } };
      if (!response.ok) providerError(response.status, json?.error?.description ?? "Failed to create Razorpay order");
      return json;
    },
    async verifyRazorpaySignature(input) {
      const { keySecret } = requireRazorpay();
      const key = await crypto.subtle.importKey("raw", encoder.encode(keySecret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${input.orderId}|${input.paymentId}`));
      return timingSafeHexEqual(bytesToHex(new Uint8Array(signature)), input.signature);
    },
    async fetchRazorpayPayment(paymentId) {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: razorpayAuthHeader() }
      });
      const json = await response.json().catch(() => ({})) as D1RazorpayPayment & { error?: { description?: string } };
      if (!response.ok) providerError(response.status, json?.error?.description ?? "Failed to verify Razorpay payment");
      return json;
    },
    async verifyGooglePlayProduct(input) {
      const packageName = requirePackageName();
      const accessToken = await googleAccessToken();
      const url = new URL(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
        `/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const json = await response.json().catch(() => ({})) as D1GooglePlayProduct & { error?: { message?: string } };
      if (!response.ok) providerError(response.status, json?.error?.message ?? "Google Play purchase verification failed");
      return json;
    },
    async consumeGooglePlayProduct(input) {
      const packageName = requirePackageName();
      const verified = await this.verifyGooglePlayProduct(input);
      if (verified.consumptionState === 1) return;
      const accessToken = await googleAccessToken();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
        `/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:consume`;
      const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) {
        const json = await response.json().catch(() => ({})) as { error?: { message?: string } };
        providerError(response.status, json?.error?.message ?? "Google Play purchase consumption failed");
      }
    }
  };
}
