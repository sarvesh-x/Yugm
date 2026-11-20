import type * as adminType from "firebase-admin";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { DeviceToken } from "../models/DeviceToken.js";

let admin: typeof adminType | undefined;
interface VerifiedFirebaseIdToken extends jwt.JwtPayload {
  uid: string;
  sub: string;
  auth_time: number;
  email?: string;
  name?: string;
  picture?: string;
  phone_number?: string;
  email_verified?: boolean;
  firebase?: {
    sign_in_provider?: string;
    [key: string]: unknown;
  };
}
const firebaseCertsUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const googleCertsUrl = "https://www.googleapis.com/oauth2/v1/certs";
let signingCertCache: { certs: Record<string, string>; expiresAt: number } | undefined;
let signingCertRequest: Promise<Record<string, string>> | undefined;
let googleCertCache: { certs: Record<string, string>; expiresAt: number } | undefined;
let googleCertRequest: Promise<Record<string, string>> | undefined;

async function getFirebaseSigningCerts(): Promise<Record<string, string>> {
  if (signingCertCache && signingCertCache.expiresAt > Date.now()) return signingCertCache.certs;
  if (!signingCertRequest) {
    signingCertRequest = (async () => {
      const response = await fetch(firebaseCertsUrl, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw Object.assign(new Error("Could not retrieve Firebase signing certificates"), { status: 503 });
      const certs = await response.json() as Record<string, unknown>;
      const validCerts = Object.fromEntries(
        Object.entries(certs).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      );
      if (!Object.keys(validCerts).length) {
        throw Object.assign(new Error("Firebase signing certificate response was empty"), { status: 503 });
      }
      const maxAge = response.headers.get("cache-control")?.match(/max-age=(\d+)/i);
      const cacheSeconds = maxAge ? Number(maxAge[1]) : 300;
      signingCertCache = { certs: validCerts, expiresAt: Date.now() + cacheSeconds * 1000 };
      return validCerts;
    })().finally(() => {
      signingCertRequest = undefined;
    });
  }
  return signingCertRequest;
}

async function getGoogleSigningCerts(): Promise<Record<string, string>> {
  if (googleCertCache && googleCertCache.expiresAt > Date.now()) return googleCertCache.certs;
  if (!googleCertRequest) {
    googleCertRequest = (async () => {
      const response = await fetch(googleCertsUrl, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw Object.assign(new Error("Could not retrieve Google signing certificates"), { status: 503 });
      const certs = await response.json() as Record<string, unknown>;
      const validCerts = Object.fromEntries(
        Object.entries(certs).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      );
      if (!Object.keys(validCerts).length) {
        throw Object.assign(new Error("Google signing certificate response was empty"), { status: 503 });
      }
      const maxAge = response.headers.get("cache-control")?.match(/max-age=(\d+)/i);
      const cacheSeconds = maxAge ? Number(maxAge[1]) : 300;
      googleCertCache = { certs: validCerts, expiresAt: Date.now() + cacheSeconds * 1000 };
      return validCerts;
    })().finally(() => {
      googleCertRequest = undefined;
    });
  }
  return googleCertRequest;
}

async function verifyFirebaseIdTokenWithoutServiceAccount(idToken: string): Promise<VerifiedFirebaseIdToken> {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded.payload === "string" || typeof decoded.header.kid !== "string") {
    throw Object.assign(new Error("Invalid Firebase ID token"), { status: 401 });
  }

  const iss = typeof decoded.payload === "object" ? decoded.payload.iss : undefined;
  const isGoogleIssuer = iss === "accounts.google.com" || iss === "https://accounts.google.com";

  if (isGoogleIssuer) {
    const certs = await getGoogleSigningCerts();
    const certificate = certs[decoded.header.kid];
    if (!certificate) throw Object.assign(new Error("Google signing key is unknown"), { status: 401 });

    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(idToken, certificate, {
        algorithms: ["RS256"],
        clockTolerance: 60
      });
    } catch (err: any) {
      throw Object.assign(new Error(`Invalid Google ID token: ${err?.message || "verification failed"}`), { status: 401 });
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub.trim() || payload.sub.length > 128 ||
        typeof payload.iat !== "number" || payload.iat > (now + 60)) {
      throw Object.assign(new Error("Invalid Google ID token claims"), { status: 401 });
    }
    return {
      uid: payload.sub,
      sub: payload.sub,
      auth_time: typeof payload.auth_time === "number" ? payload.auth_time : (payload.iat || now),
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
      email_verified: Boolean(payload.email_verified),
      firebase: { sign_in_provider: "google.com" }
    } as VerifiedFirebaseIdToken;
  }

  const certs = await getFirebaseSigningCerts();
  const certificate = certs[decoded.header.kid];
  if (!certificate) throw Object.assign(new Error("Firebase signing key is unknown"), { status: 401 });

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(idToken, certificate, {
      algorithms: ["RS256"],
      audience: env.FCM_PROJECT_ID,
      issuer: `https://securetoken.google.com/${env.FCM_PROJECT_ID}`,
      clockTolerance: 60
    });
  } catch (err: any) {
    throw Object.assign(new Error(`Invalid Firebase ID token: ${err?.message || "verification failed"}`), { status: 401 });
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub.trim() || payload.sub.length > 128 ||
      typeof payload.iat !== "number" || payload.iat > (now + 60) ||
      typeof payload.auth_time !== "number" || payload.auth_time > (payload.iat + 60)) {
    throw Object.assign(new Error("Invalid Firebase ID token claims"), { status: 401 });
  }
  return { ...payload, uid: payload.sub } as VerifiedFirebaseIdToken;
}

async function fb() {
  if (!admin) {
    // firebase-admin is CommonJS: Node's dynamic import exposes the Admin
    // namespace on `default`, rather than as ESM named exports.
    const firebaseAdmin = await import("firebase-admin");
    admin = firebaseAdmin.default as typeof adminType;
  }
  return admin;
}

export async function initFirebase() {
  if (admin?.apps.length) return;
  const projectId = env.FCM_PROJECT_ID;
  const clientEmail = env.FCM_CLIENT_EMAIL;
  const rawKey = env.FCM_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    console.log("Firebase Admin service account is not configured; ID-token verification will use Firebase public signing keys and push notifications are disabled.");
    return;
  }
  const firebase = await fb();
  const privateKey = rawKey.includes("-----BEGIN") && rawKey.includes("\n")
    ? rawKey
    : rawKey.replace(/\\n/g, "\n");
  firebase.initializeApp({
    credential: firebase.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
  console.log("Firebase initialized (FCM + Auth)");
}

export async function verifyIdToken(idToken: string): Promise<VerifiedFirebaseIdToken> {
  if (!admin?.apps.length) return verifyFirebaseIdTokenWithoutServiceAccount(idToken);
  const firebase = await fb();
  try {
    return await firebase.auth().verifyIdToken(idToken) as VerifiedFirebaseIdToken;
  } catch (err: any) {
    console.error("Firebase ID token verification failed:", err);
    throw Object.assign(new Error(`Invalid Firebase ID token: ${err.message}`), { status: 401 });
  }
}

export async function verifyAppCheckToken(token: string) {
  if (!admin?.apps.length) {
    throw new Error("App Check enforcement requires FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY for Firebase Admin verification");
  }
  const firebase = await fb();
  // The Android client sends limited-use tokens. Consume on verification so a
  // token replay is rejected by the middleware's alreadyConsumed check.
  return firebase.appCheck().verifyToken(token, { consume: true });
}

export async function deleteFirebaseUser(uid: string): Promise<{ deleted: boolean; reason?: "not_configured" | "not_found" }> {
  const normalizedUid = uid?.trim();
  if (!normalizedUid) return { deleted: false, reason: "not_found" };

  if (!admin?.apps.length) {
    console.warn("Firebase Admin is not configured; cannot delete Firebase Auth user", normalizedUid);
    return { deleted: false, reason: "not_configured" };
  }

  const firebase = await fb();
  try {
    await firebase.auth().deleteUser(normalizedUid);
    return { deleted: true };
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      return { deleted: false, reason: "not_found" };
    }
    throw err;
  }
}

export async function notifyUser(userId: string, title: string, body: string, data: Record<string, string> = {}) {
  if (!admin?.apps.length) return;
  const firebase = await fb();
  const tokens = await DeviceToken.find({ userId }).select("token");
  if (!tokens.length) return;
  const response = await firebase.messaging().sendEachForMulticast({
    tokens: tokens.map((item) => item.token),
    notification: { title, body },
    data
  });
  const invalidTokens: string[] = [];
  response.responses.forEach((resp: any, idx: number) => {
    if (resp.error?.code === "messaging/registration-token-not-registered") {
      invalidTokens.push(tokens[idx].token);
    }
  });
  if (invalidTokens.length) {
    await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
  }
}
