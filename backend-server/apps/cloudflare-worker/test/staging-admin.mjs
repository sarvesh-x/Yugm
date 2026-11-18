import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

if (!process.argv.includes("--confirm-isolated-staging")) throw new Error("Explicit isolated staging confirmation is required");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vars = dotenv.parse(await readFile(path.join(root, ".dev.vars.staging")));
if (vars.STAGING_DB_ISOLATED !== "true" || !vars.MONGODB_URI) throw new Error("Isolated staging credentials are incomplete");
const address = "https://yugm-api-staging.sarveshkumar10101.workers.dev";
const client = new mongoose.mongo.MongoClient(vars.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const adminId = new mongoose.Types.ObjectId();
const email = `staging-${randomUUID()}@example.invalid`;
const password = randomBytes(32).toString("base64url");
let db;
let cleanupError;
try {
  await client.connect();
  db = client.db("YugmStaging");
  await db.collection("adminusers").insertOne({
    _id: adminId, email, displayName: "Temporary staging admin", role: "SUPER_ADMIN", status: "ACTIVE", isSuperAdmin: true,
    permissions: [], twoFactorEnabled: false, passwordHash: await bcrypt.hash(password, 12)
  });
  const login = await fetch(`${address}/api/admin/auth/login`, {
    method: "POST", headers: { "content-type": "application/json", origin: "https://yugm-admin-staging.pages.dev" },
    body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(30000)
  });
  assert.equal(login.status, 200, "Staging admin login failed");
  const session = (await login.json()).data;
  assert.ok(session.accessToken);
  const me = await fetch(`${address}/api/admin/auth/me`, {
    headers: { authorization: `Bearer ${session.accessToken}`, origin: "https://yugm-admin-staging.pages.dev" }, signal: AbortSignal.timeout(30000)
  });
  assert.equal(me.status, 200, "Staging admin session failed");
  assert.equal((await me.json()).data.admin.id, adminId.toString());
  console.log("Cloudflare staging admin login and authenticated session passed.");
} finally {
  if (db) {
    try {
      await db.collection("adminsessions").deleteMany({ adminId });
      await db.collection("adminauditlogs").deleteMany({ $or: [{ adminId }, { "metadata.email": email }] });
      await db.collection("adminusers").deleteOne({ _id: adminId });
    } catch (error) { cleanupError = error; }
  }
  await client.close();
  if (cleanupError) throw new Error(`Could not remove staging admin fixture: ${cleanupError.name}`);
}
