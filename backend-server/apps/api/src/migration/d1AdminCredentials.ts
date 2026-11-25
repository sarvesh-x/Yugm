import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { createFirebasePasswordAccount, verifyIdToken } from "../services/firebase.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export type AdminCredentialConfig = { production?: boolean; firebaseApiKey?: string };
export const hashAdminToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function adminFirebaseIdentity(token: string) {
  const identity = await verifyIdToken(token);
  if (!identity.iss?.startsWith("https://securetoken.google.com/")) {
    throw new HttpError(401, "A Firebase ID token is required", ErrorCode.UNAUTHORIZED);
  }
  return identity;
}

async function firebasePasswordRequest(config: AdminCredentialConfig, method: "signInWithPassword" | "update", body: object) {
  if (!config.firebaseApiKey) throw new HttpError(503, "Firebase admin password sign-in is not configured");
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(config.firebaseApiKey)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, returnSecureToken: true }), signal: AbortSignal.timeout(10_000)
  });
  if (result.status === 429 || result.status >= 500) throw new HttpError(503, "Firebase sign-in is temporarily unavailable");
  if (!result.ok) throw new HttpError(401, "Invalid admin credentials", ErrorCode.UNAUTHORIZED);
  const { idToken } = await result.json() as { idToken?: string };
  if (!idToken) throw new HttpError(503, "Firebase sign-in response was incomplete");
  return idToken;
}

export function firebasePasswordLogin(config: AdminCredentialConfig, email: string, password: string) {
  return firebasePasswordRequest(config, "signInWithPassword", { email, password });
}

export function changeFirebaseAdminPassword(config: AdminCredentialConfig, idToken: string, password: string) {
  return firebasePasswordRequest(config, "update", { idToken, password });
}

export async function provisionAdminPassword(config: AdminCredentialConfig, id: string, email: string, password: string) {
  if (!config.production) {
    if (Buffer.byteLength(password, "utf8") > 72) {
      throw new HttpError(422, "Local admin passwords may contain at most 72 UTF-8 bytes", ErrorCode.VALIDATION);
    }
    return { passwordHash: await bcrypt.hash(password, 12), firebaseUid: null };
  }
  const uid = `yugm-admin-${id}`;
  try {
    await createFirebasePasswordAccount(uid, email, password);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/email-already-exists" && code !== "auth/uid-already-exists") throw error;
    // An interrupted invite can resume only with the credentials for the same reserved UID.
    const token = await firebasePasswordLogin(config, email, password);
    const identity = await adminFirebaseIdentity(token);
    if (identity.uid !== uid) throw new HttpError(409, "Email is already assigned to a Firebase account", ErrorCode.CONFLICT);
  }
  return { passwordHash: null, firebaseUid: uid };
}

export function localAdminPasswordMatches(password: string, hash: string | null) {
  return hash ? bcrypt.compare(password, hash) : Promise.resolve(false);
}
