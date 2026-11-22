import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, mock, test } from "node:test";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import sharp from "sharp";

// Storage and auth configuration must exist before env.ts is first imported.
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "r2-route-test-jwt-secret-at-least-32-chars";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";
process.env.STORAGE_DRIVER = "s3";
process.env.R2_ACCOUNT_ID ??= "test-account";
process.env.R2_ACCESS_KEY_ID ??= "test-access-key";
process.env.R2_SECRET_ACCESS_KEY ??= "test-secret-key";
process.env.R2_PUBLIC_MEDIA_BUCKET ??= "yugm-public-media";
process.env.R2_PRIVATE_MEDIA_BUCKET ??= "yugm-private-media";
process.env.R2_ORIGINALS_BUCKET ??= "yugm-originals";
process.env.R2_STAGING_BUCKET ??= "yugm-staging";
process.env.R2_MEDIA_PUBLIC_URL ??= "https://media.example.test";

interface StoredObject {
  body: Buffer;
  contentType?: string;
}

const objects = new Map<string, StoredObject>();
const objectId = (bucket?: string, key?: string) => `${bucket ?? ""}/${key ?? ""}`;

let mongod: MongoMemoryServer;
let server: http.Server;
let baseUrl: string;
let sendMock: ReturnType<typeof mock.method> | undefined;
let models: {
  AuthSession: typeof import("../models/AuthSession.js").AuthSession;
  MediaObject: typeof import("../models/MediaObject.js").MediaObject;
  MediaUploadSession: typeof import("../models/MediaUploadSession.js").MediaUploadSession;
  User: typeof import("../models/User.js").User;
};
let signAccessToken: typeof import("../services/tokens.js").signAccessToken;
let png: Buffer;
let actorId: string;
let actorToken: string;
let outsiderToken: string;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("yugm-r2-http-routes"));
  const { mediaRouter } = await import("../routes/media.js");
  const { getManagedS3Client } = await import("./storage.js");
  ({ signAccessToken } = await import("../services/tokens.js"));
  models = {
    AuthSession: (await import("../models/AuthSession.js")).AuthSession,
    MediaObject: (await import("../models/MediaObject.js")).MediaObject,
    MediaUploadSession: (await import("../models/MediaUploadSession.js")).MediaUploadSession,
    User: (await import("../models/User.js")).User
  };

  sendMock = mock.method(getManagedS3Client(), "send", async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const input = command.input;
    const bucket = input.Bucket as string | undefined;
    const key = input.Key as string | undefined;
    if (command instanceof PutObjectCommand) {
      objects.set(objectId(bucket, key), {
        body: Buffer.from(input.Body as Uint8Array),
        contentType: input.ContentType as string | undefined
      });
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const stored = objects.get(objectId(bucket, key));
      if (!stored) throw Object.assign(new Error("NotFound"), { name: "NotFound" });
      return {
        Body: { transformToByteArray: async () => new Uint8Array(stored.body) },
        ContentType: stored.contentType,
        ContentLength: stored.body.length
      };
    }
    if (command instanceof CopyObjectCommand) {
      const source = String(input.CopySource ?? "").split("/");
      const sourceBucket = source.shift();
      const sourceKey = source.map(decodeURIComponent).join("/");
      const stored = objects.get(objectId(sourceBucket, sourceKey));
      if (!stored) throw Object.assign(new Error("NotFound"), { name: "NotFound" });
      objects.set(objectId(bucket, key), { ...stored, contentType: input.ContentType as string | undefined });
      return {};
    }
    if (command instanceof DeleteObjectCommand) {
      objects.delete(objectId(bucket, key));
      return {};
    }
    if (command instanceof HeadObjectCommand) {
      if (!objects.has(objectId(bucket, key))) throw Object.assign(new Error("NotFound"), { name: "NotFound" });
      return {};
    }
    return {};
  });

  const app = express();
  app.use(express.json());
  app.use("/api", mediaRouter);
  app.use((error: { status?: number; message?: string; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({
      ok: false,
      error: { message: error.message ?? "Unexpected server error", code: error.code }
    });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  png = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#7c4dff" } })
    .png()
    .toBuffer();
  const stamp = randomUUID().slice(0, 8);
  const actor = await models.User.create({ name: "Route Actor", username: `route_actor_${stamp}` });
  const outsider = await models.User.create({ name: "Route Outsider", username: `route_outsider_${stamp}` });
  actorId = String(actor._id);
  actorToken = await tokenFor(actor);
  outsiderToken = await tokenFor(outsider);
});

after(async () => {
  sendMock?.mock.restore();
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongod?.stop();
});

async function tokenFor(user: InstanceType<typeof models.User>) {
  const session = await models.AuthSession.create({
    userId: user._id,
    familyId: randomUUID(),
    refreshHash: randomUUID(),
    expiresAt: new Date(Date.now() + 3_600_000),
    tokenVersion: user.tokenVersion
  });
  return signAccessToken(user, session.id);
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() as { ok: boolean; data?: any; error?: { message?: string; code?: string } } };
}

function avatarBody(overrides: Record<string, unknown> = {}) {
  return { category: "AVATAR", contentType: "image/png", fileName: "avatar.png", bytes: png.length, ...overrides };
}

async function createGrant(token = actorToken) {
  const response = await call("POST", "/media/uploads", token, avatarBody());
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data;
}

async function stageBytes(sessionId: string) {
  const session = await models.MediaUploadSession.findById(sessionId).lean();
  assert.ok(session);
  objects.set(objectId("yugm-staging", session.stagingKey), { body: png, contentType: "image/png" });
}

test("media routes require authentication and validate grants before storage work", async () => {
  const unauthenticated = await call("POST", "/media/uploads", undefined, avatarBody());
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.ok, false);

  const unsupported = await call("POST", "/media/uploads", actorToken, avatarBody({ category: "GALLERY" }));
  assert.equal(unsupported.status, 400);
  assert.match(unsupported.body.error?.message ?? "", /not yet available/);

  const invalidBytes = await call("POST", "/media/uploads", actorToken, avatarBody({ bytes: 0 }));
  assert.equal(invalidBytes.status, 413);
  assert.match(invalidBytes.body.error?.message ?? "", /between 1 byte/);

  const invalidFileName = await call("POST", "/media/uploads", actorToken, avatarBody({ fileName: "../avatar.png" }));
  assert.equal(invalidFileName.status, 400);
  assert.match(invalidFileName.body.error?.message ?? "", /file name/);

  assert.equal(await models.MediaUploadSession.countDocuments(), 0);
});

test("create response returns a signed grant but no bucket, key or owner", async () => {
  const grant = await createGrant();
  assert.equal(grant.category, "AVATAR");
  assert.equal(grant.method, "PUT");
  assert.match(grant.uploadUrl, /X-Amz-Signature=/);
  assert.ok(grant.requiredHeaders);
  // The signed URL necessarily encodes the server-generated bucket/key; the
  // grant itself must not expose those as separate fields or any owner identity.
  assert.deepEqual(Object.keys(grant).sort(), [
    "category", "expiresAt", "expiresIn", "maxBytes", "method", "requiredHeaders", "sessionId", "uploadUrl"
  ]);
  assert.ok(!JSON.stringify(grant).includes(actorId));
});

test("complete is idempotent and never returns signed or private object URLs", async () => {
  const grant = await createGrant();
  await stageBytes(grant.sessionId);
  const first = await call("POST", `/media/uploads/${grant.sessionId}/complete`, actorToken);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.match(first.body.data.avatarUrl, /^https:\/\/media\.example\.test\/users\//);
  assert.match(first.body.data.avatarUrl, /avatar_256\.webp$/);

  const serialized = JSON.stringify(first.body);
  assert.ok(!serialized.includes("X-Amz-Signature"));
  assert.ok(!serialized.includes("yugm-originals"));
  assert.ok(!serialized.includes("staging/"));

  const repeated = await call("POST", `/media/uploads/${grant.sessionId}/complete`, actorToken);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.data.mediaId, first.body.data.mediaId);
  assert.equal(repeated.body.data.avatarUrl, first.body.data.avatarUrl);
});

test("cancel and expiry surface stable route errors", async () => {
  const cancelledGrant = await createGrant();
  const cancelled = await call("DELETE", `/media/uploads/${cancelledGrant.sessionId}`, actorToken);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, "CANCELLED");
  const cancelledAgain = await call("DELETE", `/media/uploads/${cancelledGrant.sessionId}`, actorToken);
  assert.equal(cancelledAgain.status, 200);
  assert.equal(cancelledAgain.body.data.status, "CANCELLED");
  const completedAfterCancel = await call("POST", `/media/uploads/${cancelledGrant.sessionId}/complete`, actorToken);
  assert.equal(completedAfterCancel.status, 409);
  assert.match(completedAfterCancel.body.error?.message ?? "", /no longer pending/);

  const expiredGrant = await createGrant();
  await models.MediaUploadSession.updateOne(
    { _id: expiredGrant.sessionId },
    { $set: { expiresAt: new Date(Date.now() - 1000) } }
  );
  const expired = await call("POST", `/media/uploads/${expiredGrant.sessionId}/complete`, actorToken);
  assert.equal(expired.status, 410);
  assert.match(expired.body.error?.message ?? "", /expired/);
  const expiredAgain = await call("POST", `/media/uploads/${expiredGrant.sessionId}/complete`, actorToken);
  assert.equal(expiredAgain.status, 409);
});

test("private download is authorized at the route and signs only the response", async () => {
  const stamp = randomUUID();
  const privateMedia = await models.MediaObject.create({
    _id: stamp,
    ownerType: "USER",
    ownerId: actorId,
    mediaType: "IMAGE",
    category: "AVATAR",
    bucket: "private-media",
    storageKey: `users/${actorId}/avatars/v99/private.png`,
    contentType: "image/png",
    fileSize: png.length,
    checksum: "a".repeat(64),
    visibility: "PRIVATE",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    version: 99,
    variants: [],
    createdBy: actorId
  });

  const denied = await call("GET", `/media/${stamp}/download`, outsiderToken);
  assert.equal(denied.status, 403);
  assert.match(denied.body.error?.message ?? "", /access denied/);

  const granted = await call("GET", `/media/${stamp}/download`, actorToken);
  assert.equal(granted.status, 200);
  assert.match(granted.body.data.downloadUrl, /X-Amz-Signature=/);
  assert.equal(granted.body.data.media.id, String(privateMedia._id));
  const stored = await models.MediaObject.findById(stamp).lean();
  assert.ok(!JSON.stringify(stored).includes("X-Amz-Signature"));

  await models.MediaObject.updateOne({ _id: stamp }, { $set: { deletedAt: new Date() } });
  const deleted = await call("GET", `/media/${stamp}/download`, actorToken);
  assert.equal(deleted.status, 404);
  assert.match(deleted.body.error?.message ?? "", /not found/);

  await models.MediaObject.updateOne(
    { _id: stamp },
    { $unset: { deletedAt: "" }, $set: { processingStatus: "FAILED" } }
  );
  const failed = await call("GET", `/media/${stamp}/download`, actorToken);
  assert.equal(failed.status, 404);
  assert.match(failed.body.error?.message ?? "", /not found/);

  await models.MediaObject.updateOne(
    { _id: stamp },
    { $set: { processingStatus: "READY", moderationStatus: "REJECTED" } }
  );
  const rejected = await call("GET", `/media/${stamp}/download`, actorToken);
  assert.equal(rejected.status, 404);
  assert.match(rejected.body.error?.message ?? "", /not found/);

  const invalidId = await call("GET", "/media/not-a-uuid/download", actorToken);
  assert.equal(invalidId.status, 400);
  assert.match(invalidId.body.error?.message ?? "", /Invalid media id/);
});
