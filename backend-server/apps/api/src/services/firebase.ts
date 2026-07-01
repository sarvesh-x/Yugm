import { createRequire } from "node:module";
import type * as adminType from "firebase-admin";
import { env } from "../config/env.js";
import { DeviceToken } from "../models/DeviceToken.js";

const require = createRequire(import.meta.url);
const firebaseAdmin = require("firebase-admin") as typeof adminType;
let admin: typeof adminType | undefined;

function fb() {
  if (!admin) admin = firebaseAdmin;
  return admin!;
}

export function initFirebase() {
  const firebase = fb();
  if (firebase.apps.length) return;
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    console.log("Firebase disabled: service account env vars are not configured");
    return;
  }
  firebase.initializeApp({
    credential: firebase.credential.cert({
      projectId: env.FCM_PROJECT_ID,
      clientEmail: env.FCM_CLIENT_EMAIL,
      privateKey: env.FCM_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
  console.log("Firebase initialized (FCM + Auth)");
}

export async function verifyIdToken(idToken: string) {
  const firebase = fb();
  if (!firebase.apps.length) throw Object.assign(new Error("Firebase not configured"), { status: 503 });
  try {
    return await firebase.auth().verifyIdToken(idToken);
  } catch (err: any) {
    console.error("Firebase ID token verification failed:", err);
    throw Object.assign(new Error(`Invalid Firebase ID token: ${err.message}`), { status: 401 });
  }
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
