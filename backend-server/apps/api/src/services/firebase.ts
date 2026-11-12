import { createRequire } from "node:module";
import type * as adminType from "firebase-admin";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { DeviceToken } from "../models/DeviceToken.js";

const require = createRequire(import.meta.url);
const firebaseAdmin = require("firebase-admin") as typeof adminType;
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
}
const firebaseCertsUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let signingCertCache: { certs: Record<string, string>; expiresAt: number } | undefined;
let signingCertRequest: Promise<Record<string, string>> | undefined;

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

async function verifyFirebaseIdTokenWithoutServiceAccount(idToken: string): Promise<VerifiedFirebaseIdToken> {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded.payload === "string" || typeof decoded.header.kid !== "string") {
    throw Object.assign(new Error("Invalid Firebase ID token"), { status: 401 });
  }

  const certs = await getFirebaseSigningCerts();
  const certificate = certs[decoded.header.kid];
  if (!certificate) throw Object.assign(new Error("Firebase signing key is unknown"), { status: 401 });

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(idToken, certificate, {
      algorithms: ["RS256"],
      audience: env.FCM_PROJECT_ID,
      issuer: `https://securetoken.google.com/${env.FCM_PROJECT_ID}`
    });
  } catch {
    throw Object.assign(new Error("Invalid Firebase ID token"), { status: 401 });
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub.trim() || payload.sub.length > 128 ||
      typeof payload.iat !== "number" || payload.iat > now ||
      typeof payload.auth_time !== "number" || payload.auth_time > payload.iat) {
    throw Object.assign(new Error("Invalid Firebase ID token claims"), { status: 401 });
  }
  return { ...payload, uid: payload.sub } as VerifiedFirebaseIdToken;
}

function fb() {
  if (!admin) admin = firebaseAdmin;
  return admin!;
}

export function initFirebase() {
  const firebase = fb();
  if (firebase.apps.length) return;
  const projectId = env.FCM_PROJECT_ID;
  const clientEmail = env.FCM_CLIENT_EMAIL;
  const rawKey = env.FCM_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    console.log("Firebase Admin service account is not configured; ID-token verification will use Firebase public signing keys and push notifications are disabled.");
    return;
  }
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
  const firebase = fb();
  if (!firebase.apps.length) return verifyFirebaseIdTokenWithoutServiceAccount(idToken);
  try {
    return await firebase.auth().verifyIdToken(idToken) as VerifiedFirebaseIdToken;
  } catch (err: any) {
    console.error("Firebase ID token verification failed:", err);
    throw Object.assign(new Error(`Invalid Firebase ID token: ${err.message}`), { status: 401 });
  }
}

export async function verifyAppCheckToken(token: string) {
  const firebase = fb();
  if (!firebase.apps.length) throw new Error("Firebase Admin service account is required for App Check verification");
  return firebase.appCheck().verifyToken(token, { consume: true });
}

export async function notifyUser(userId: string, title: string, body: string, data: Record<string, string> = {}) {
  const firebase = fb();
  if (!firebase.apps.length) return;
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
