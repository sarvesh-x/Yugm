import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, mock, test } from "node:test";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import sharp from "sharp";

// Configure storage before dynamic imports: env.ts parses process.env at module load.
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
let sendMock: ReturnType<typeof mock.method> | undefined;
let media: typeof import("./media.js");
let mediaModels: {
  MediaObject: typeof import("../models/MediaObject.js").MediaObject;
  MediaQuotaReservation: typeof import("../models/MediaQuotaReservation.js").MediaQuotaReservation;
  MediaUploadSession: typeof import("../models/MediaUploadSession.js").MediaUploadSession;
  User: typeof import("../models/User.js").User;
  DirectMessage: typeof import("../models/DirectMessage.js").DirectMessage;
  Block: typeof import("../models/Block.js").Block;
};
let getManagedS3Client: typeof import("./storage.js").getManagedS3Client;
let png: Buffer;
let userId: string;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("yugm-r2-integration"));
  media = await import("./media.js");
  mediaModels = {
    MediaObject: (await import("../models/MediaObject.js")).MediaObject,
    MediaQuotaReservation: (await import("../models/MediaQuotaReservation.js")).MediaQuotaReservation,
    MediaUploadSession: (await import("../models/MediaUploadSession.js")).MediaUploadSession,
    User: (await import("../models/User.js")).User,
    DirectMessage: (await import("../models/DirectMessage.js")).DirectMessage,
    Block: (await import("../models/Block.js")).Block
  };
  ({ getManagedS3Client } = await import("./storage.js"));

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

  png = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#7c4dff" } })
    .png()
    .toBuffer();
  const user = await mediaModels.User.create({ name: "Media Test", username: `media_test_${Date.now()}` });
  userId = String(user._id);
});

after(async () => {
  sendMock?.mock.restore();
  await mongoose.disconnect();
  await mongod?.stop();
});

async function stageAvatar(): Promise<string> {
  const grant = await media.createUploadSession({
    category: "AVATAR",
    contentType: "image/png",
    fileName: "avatar.png",
    bytes: png.length,
    actorId: userId
  });
  const session = await mediaModels.MediaUploadSession.findById(grant.sessionId).lean();
  assert.ok(session);
  objects.set(objectId("yugm-staging", session.stagingKey), { body: png, contentType: "image/png" });
  return grant.sessionId;
}

async function reservedBytes(id: string) {
  return (await mediaModels.MediaQuotaReservation.findById(id).lean())?.bytes ?? 0;
}

test("managed avatar upload commits atomically, is idempotent, and preserves the prior version", async () => {
  const firstSessionId = await stageAvatar();
  assert.equal(await reservedBytes(userId), png.length);
  const first = await media.completeUploadSession(firstSessionId, userId);
  assert.equal(await reservedBytes(userId), 0);
  assert.match(first.avatarUrl, /^https:\/\/media\.example\.test\/users\//);
  assert.match(first.avatarUrl, /avatar_256\.webp$/);

  const user = await mediaModels.User.findById(userId).lean();
  assert.equal(user?.avatar, first.avatarUrl);
  assert.equal(user?.avatarMediaId, first.mediaId);
  assert.equal(user?.avatarType, "UPLOADED");

  const firstMedia = await mediaModels.MediaObject.findById(first.mediaId).lean();
  assert.match(firstMedia?.checksum ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(
    firstMedia?.variants.map((variant) => variant.name).sort(),
    ["avatar_128", "avatar_256", "avatar_64", "original"]
  );
  assert.ok(objects.has(objectId("yugm-originals", firstMedia!.variants.find((v) => v.name === "original")!.key)));
  assert.ok(objects.has(objectId("yugm-public-media", firstMedia!.storageKey)));

  const repeated = await media.completeUploadSession(firstSessionId, userId);
  assert.equal(repeated.mediaId, first.mediaId);
  assert.equal(repeated.version, first.version);
  assert.equal(repeated.avatarUrl, first.avatarUrl);
  assert.equal(await mediaModels.MediaObject.countDocuments(), 1);

  const secondSessionId = await stageAvatar();
  assert.equal(await reservedBytes(userId), png.length);
  const second = await media.completeUploadSession(secondSessionId, userId);
  assert.equal(await reservedBytes(userId), 0);
  const previous = await mediaModels.MediaObject.findById(first.mediaId).lean();
  assert.equal(previous?.supersededById, second.mediaId);
  assert.equal(await mediaModels.MediaObject.countDocuments(), 2);
});

test("expired sessions are marked EXPIRED and cancelled sessions remove only their staging object", async () => {
  const expiredSessionId = await stageAvatar();
  await mediaModels.MediaUploadSession.updateOne(
    { _id: expiredSessionId },
    { $set: { expiresAt: new Date(Date.now() - 1000) } }
  );
  await assert.rejects(
    () => media.completeUploadSession(expiredSessionId, userId),
    /Upload session has expired/
  );
  const expired = await mediaModels.MediaUploadSession.findById(expiredSessionId).lean();
  assert.equal(expired?.status, "EXPIRED");
  assert.equal(await reservedBytes(userId), 0);

  const cancelledSessionId = await stageAvatar();
  assert.equal(await reservedBytes(userId), png.length);
  const cancelledSession = await mediaModels.MediaUploadSession.findById(cancelledSessionId).lean();
  assert.ok(cancelledSession);
  assert.ok(objects.has(objectId("yugm-staging", cancelledSession.stagingKey)));
  const cancelled = await media.cancelUploadSession(cancelledSessionId, userId);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(await reservedBytes(userId), 0);
  assert.ok(!objects.has(objectId("yugm-staging", cancelledSession.stagingKey)));
  assert.deepEqual(await media.cancelUploadSession(cancelledSessionId, userId), {
    sessionId: cancelledSessionId,
    status: "CANCELLED"
  });
  await assert.rejects(
    () => media.completeUploadSession(cancelledSessionId, userId),
    /no longer pending/
  );
});

test("quota checks count committed media before issuing a new staging grant", async () => {
  const quota = 512 * 1024 * 1024;
  await mediaModels.MediaObject.create({
    _id: randomUUID(),
    ownerType: "USER",
    ownerId: userId,
    mediaType: "IMAGE",
    category: "COVER",
    bucket: "public-media",
    storageKey: `users/${userId}/covers/v1/full.webp`,
    contentType: "image/webp",
    fileSize: quota - 1024,
    checksum: "c".repeat(64),
    visibility: "PUBLIC",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    version: 98,
    variants: [],
    createdBy: userId
  });

  await assert.rejects(
    () => media.createUploadSession({
      category: "AVATAR",
      contentType: "image/png",
      fileName: "too-large.png",
      bytes: 2 * 1024 * 1024,
      actorId: userId
    }),
    /quota has been reached/
  );
});

test("concurrent staging grants cannot both spend the same quota bytes", async () => {
  const quota = 512 * 1024 * 1024;
  const stamp = randomUUID().slice(0, 8);
  const user = await mediaModels.User.create({ name: "Quota Race", username: `quota_race_${stamp}` });
  const racerId = String(user._id);
  await mediaModels.MediaObject.create([
    {
      _id: randomUUID(),
      ownerType: "USER",
      ownerId: racerId,
      mediaType: "IMAGE",
      category: "GALLERY",
      bucket: "public-media",
      storageKey: `users/${racerId}/gallery/v70/full.webp`,
      contentType: "image/webp",
      fileSize: 6 * 1024 * 1024,
      checksum: "d".repeat(64),
      visibility: "PUBLIC",
      processingStatus: "READY",
      moderationStatus: "APPROVED",
      version: 70,
      variants: [],
      createdBy: racerId
    },
    {
      _id: randomUUID(),
      ownerType: "USER",
      ownerId: racerId,
      mediaType: "IMAGE",
      category: "GALLERY",
      bucket: "public-media",
      storageKey: `users/${racerId}/gallery/v71/full.webp`,
      contentType: "image/webp",
      fileSize: quota - 12 * 1024 * 1024 - 6 * 1024 * 1024,
      checksum: "e".repeat(64),
      visibility: "PUBLIC",
      processingStatus: "READY",
      moderationStatus: "APPROVED",
      version: 71,
      variants: [],
      createdBy: racerId
    }
  ]);

  const results = await Promise.allSettled(
    [0, 1, 2].map(() => media.createUploadSession({
      category: "AVATAR",
      contentType: "image/png",
      fileName: "race.png",
      bytes: 5 * 1024 * 1024,
      actorId: racerId
    }))
  );
  const granted = results.filter((result) => result.status === "fulfilled").length;
  const denied = results.filter((result) => result.status === "rejected");
  assert.equal(granted, 2);
  assert.equal(denied.length, 1);
  assert.match(String(denied[0].status === "rejected" ? denied[0].reason : ""), /quota has been reached/);
  assert.equal(await mediaModels.MediaUploadSession.countDocuments({ userId: racerId, status: "PENDING" }), 2);
  assert.equal(await reservedBytes(racerId), 10 * 1024 * 1024);
});

test("private downloads require ownership or participation and never persist the signed URL", async () => {
  const privateMedia = await mediaModels.MediaObject.create({
    _id: randomUUID(),
    ownerType: "USER",
    ownerId: userId,
    mediaType: "IMAGE",
    category: "AVATAR",
    bucket: "private-media",
    storageKey: `users/${userId}/avatars/v1/private.png`,
    contentType: "image/png",
    fileSize: png.length,
    checksum: "a".repeat(64),
    visibility: "PRIVATE",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    version: 99,
    variants: [],
    createdBy: userId
  });
  const grant = await media.authorizeMediaDownload(String(privateMedia._id), userId);
  assert.match(grant.downloadUrl!, /X-Amz-Signature=/);
  const stored = await mediaModels.MediaObject.findById(privateMedia._id).lean();
  assert.ok(!JSON.stringify(stored).includes("X-Amz-Signature"));

  await assert.rejects(
    () => media.authorizeMediaDownload(String(privateMedia._id), String(new mongoose.Types.ObjectId())),
    /Media access denied/
  );
  await mediaModels.MediaObject.updateOne(
    { _id: privateMedia._id },
    { $set: { moderationStatus: "REJECTED" } }
  );
  await assert.rejects(
    () => media.authorizeMediaDownload(String(privateMedia._id), userId),
    /Media not found/
  );
});

test("message media access checks participation, hidden state and blocks", async () => {
  const stamp = randomUUID().slice(0, 8);
  const [sender, receiver, outsider] = await mediaModels.User.create([
    { name: "Sender", username: `sender_${stamp}` },
    { name: "Receiver", username: `receiver_${stamp}` },
    { name: "Outsider", username: `outsider_${stamp}` }
  ]);
  const message = await mediaModels.DirectMessage.create({
    senderId: sender._id,
    receiverId: receiver._id,
    message: "private photo",
    mediaUrl: "https://media.example.test/private.png"
  });
  const messageMedia = await mediaModels.MediaObject.create({
    _id: randomUUID(),
    ownerType: "MESSAGE",
    ownerId: String(message._id),
    mediaType: "IMAGE",
    category: "CHAT_IMAGE",
    bucket: "private-media",
    storageKey: `messages/${String(message._id)}/chat-images/v1/original.png`,
    contentType: "image/png",
    fileSize: png.length,
    checksum: "b".repeat(64),
    visibility: "PRIVATE",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    version: 1,
    variants: [],
    createdBy: String(sender._id)
  });
  const mediaId = String(messageMedia._id);

  assert.match((await media.authorizeMediaDownload(mediaId, String(sender._id))).downloadUrl!, /X-Amz-Signature=/);
  assert.match((await media.authorizeMediaDownload(mediaId, String(receiver._id))).downloadUrl!, /X-Amz-Signature=/);
  await assert.rejects(
    () => media.authorizeMediaDownload(mediaId, String(outsider._id)),
    /Media access denied/
  );

  await mediaModels.DirectMessage.updateOne(
    { _id: message._id },
    { $addToSet: { hiddenFor: receiver._id } }
  );
  await assert.rejects(
    () => media.authorizeMediaDownload(mediaId, String(receiver._id)),
    /Media access denied/
  );
  await mediaModels.DirectMessage.updateOne(
    { _id: message._id },
    { $pull: { hiddenFor: receiver._id } }
  );

  await mediaModels.Block.create({ blockerId: receiver._id, blockedUserId: sender._id });
  await assert.rejects(
    () => media.authorizeMediaDownload(mediaId, String(receiver._id)),
    /Media access denied/
  );
  await mediaModels.Block.deleteOne({ blockerId: receiver._id, blockedUserId: sender._id });
  assert.match((await media.authorizeMediaDownload(mediaId, String(receiver._id))).downloadUrl!, /X-Amz-Signature=/);
});
