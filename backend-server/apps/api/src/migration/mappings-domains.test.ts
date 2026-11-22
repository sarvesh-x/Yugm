import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const USER = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";
const ADMIN = "507f1f77bcf86cd799439013";
const ROOM = "507f1f77bcf86cd799439014";
const GIFT = "507f1f77bcf86cd799439015";
const TXN = "507f1f77bcf86cd799439016";
const ASSET_ID = "asset-0001";

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-domains");
  const result = applyMapping(collection, record, context);
  context.assertAccountedFor();
  return { context, result };
}

function table(result: { writes: Array<{ table: string; rows: TargetRow[] }> }, name: string): TargetRow[] {
  return result.writes.find((write) => write.table === name)?.rows ?? [];
}

function assertColumns(result: { writes: Array<{ table: string; rows: TargetRow[] }> }) {
  for (const write of result.writes) {
    for (const row of write.rows) {
      for (const key of Object.keys(row)) {
        assert.match(key, /^[A-Za-z_][A-Za-z0-9_]*$/, `${write.table}.${key}`);
      }
    }
  }
}

test("admin sessions preserve admin reference, refresh hash and revocation state", () => {
  const { result, context } = map("admin_sessions", {
    _id: TXN, adminId: ADMIN, refreshTokenHash: "hash-1",
    expiresAt: "2026-02-01T00:00:00Z", ipAddress: "127.0.0.1",
    userAgent: "admin-test", revokedAt: null,
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "admin_sessions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.admin_id, ADMIN);
  assert.equal(row.refresh_token_hash, "hash-1");
  assert.equal(row.expires_at, "2026-02-01T00:00:00.000Z");
  assert.equal(row.revoked_at, null);
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);

  const bad = map("admin_sessions", { _id: TXN, adminId: ADMIN, refreshTokenHash: "", expiresAt: "bad" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED", "INVALID_TIMESTAMP"]);
});

test("device tokens keep lowercase platform enums and quarantine invalid values", () => {
  const { result } = map("device_tokens", {
    _id: TXN, userId: USER, token: "fcm-token-1", platform: "android",
    lastSeenAt: "2026-01-02T03:04:05Z", createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "device_tokens")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.platform, "android");
  assert.equal(row.last_seen_at, "2026-01-02T03:04:05.000Z");

  const bad = map("device_tokens", { _id: TXN, userId: USER, token: "t", platform: "ANDROID", lastSeenAt: "2026-01-01T00:00:00Z" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("diamond transactions keep integer balances, source enums and idempotency keys", () => {
  const { result, context } = map("diamond_transactions", {
    _id: TXN, userId: USER, type: "DEBIT", source: "GIFT_SENT",
    amount: 5, balanceBefore: 20, balanceAfter: 15,
    metadata: { z: 2, a: 1 }, idempotencyKey: "idem-1",
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "diamond_transactions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.amount, 5);
  assert.equal(row.balance_after, 15);
  assert.equal(row.metadata, '{"a":1,"z":2}');
  assert.equal(row.idempotency_key, "idem-1");
  assert.deepEqual(context.quarantine, []);

  const bad = map("diamond_transactions", {
    _id: TXN, userId: USER, type: "CREDIT", source: "MINT",
    amount: 2.5, balanceBefore: 0, balanceAfter: -1
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "NON_INTEGER_MONEY", "NEGATIVE_MONEY"]);
});

test("purchases preserve provider replay keys, payment refs and integer price", () => {
  const { result, context } = map("purchases", {
    _id: TXN, userId: USER, provider: "RAZORPAY", status: "CREDITED",
    packId: "pack-1", assetCurrency: "COINS", coinAmount: 500, diamondAmount: 0,
    amountInr: 499, currency: "INR", providerOrderId: "order-1",
    providerPaymentId: "pay-1", providerSignature: "sig-1",
    creditedTransactionId: USER, refundProviderId: null,
    metadata: { campaign: "diwali" }, creditedAt: "2026-01-02T03:04:05Z",
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "purchases")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.amount_inr, 499);
  assert.equal(row.provider_order_id, "order-1");
  assert.equal(row.purchase_token, null);
  assert.equal(row.credited_transaction_id, USER);
  assert.equal(row.metadata, '{"campaign":"diwali"}');
  assert.equal(row.credited_at, "2026-01-02T03:04:05.000Z");
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);

  const bad = map("purchases", {
    _id: TXN, userId: USER, provider: "PAYPAL", status: "PAID", packId: "p",
    assetCurrency: "COINS", coinAmount: 1, diamondAmount: 0, amountInr: 1.5, currency: "USD"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "NON_INTEGER_MONEY", "UNKNOWN_ENUM"]);
});

test("gift transactions preserve idempotency metadata, party refs and empty effect", () => {
  const { result, context } = map("gift_transactions", {
    _id: TXN, roomId: ROOM, senderId: USER, receiverId: OTHER, giftId: GIFT,
    coinAmount: 100, diamondAmount: 0, currency: "COINS", type: "send",
    comboCount: 1, totalValue: 100, metadata: { idempotencyKey: "gift-1" },
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "gift_transactions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.room_id, ROOM);
  assert.equal(row.sender_id, USER);
  assert.equal(row.receiver_id, OTHER);
  assert.equal(row.gift_id, GIFT);
  assert.equal(row.total_value, 100);
  assert.equal(row.effect, "");
  assert.equal(row.metadata, '{"idempotencyKey":"gift-1"}');
  assert.deepEqual(context.quarantine, []);

  const bad = map("gift_transactions", {
    _id: TXN, senderId: USER, receiverId: OTHER, giftId: GIFT,
    coinAmount: 1, diamondAmount: 0, currency: "COINS", type: "broadcast",
    comboCount: 0, totalValue: 1
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "OUT_OF_RANGE"]);
});

test("withdrawal requests keep payout state, one-active-lock flag and admin reviewer", () => {
  const { result, context } = map("withdrawal_requests", {
    _id: TXN, userId: USER, amountCoins: 1000, amountInr: 100,
    status: "PENDING_REVIEW", activeLock: true, lockedAt: "2026-01-02T03:04:05Z",
    reviewedByAdminId: ADMIN, payoutReference: "pay-ref", metadata: { note: "review" },
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "withdrawal_requests")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.amount_coins, 1000);
  assert.equal(row.active_lock, 1);
  assert.equal(row.reviewed_by_admin_id, ADMIN);
  assert.equal(row.metadata, '{"note":"review"}');
  assert.deepEqual(context.quarantine, []);

  const bad = map("withdrawal_requests", { _id: TXN, userId: USER, amountCoins: 1, status: "UNKNOWN", activeLock: "yes" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "INVALID_BOOLEAN"]);
});

test("subscriptions preserve entitlement state and integer money split", () => {
  const { result, context } = map("subscriptions", {
    _id: TXN, subscriberId: USER, creatorId: OTHER, plan: "MONTHLY",
    coinAmount: 499, active: true, expiresAt: "2026-02-01T00:00:00Z",
    provider: "GOOGLE_PLAY", providerPurchaseToken: "token-1",
    autoRenewing: false, status: "ACTIVE", creatorCoinAmount: 449,
    platformFeeCoins: 50, renewalCount: 0, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "subscriptions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.subscriber_id, USER);
  assert.equal(row.creator_id, OTHER);
  assert.equal(row.creator_coin_amount, 449);
  assert.equal(row.platform_fee_coins, 50);
  assert.equal(row.active, 1);
  assert.equal(row.auto_renewing, 0);
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);

  const bad = map("subscriptions", {
    _id: TXN, subscriberId: USER, creatorId: OTHER, plan: "WEEKLY",
    coinAmount: 1.5, active: true, expiresAt: "2026-02-01T00:00:00Z"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "NON_INTEGER_MONEY"]);
});

test("assets preserve string IDs, catalog status, checksum and published variants", () => {
  const { result, context } = map("assets", {
    _id: ASSET_ID, ownerType: "cosmetic", ownerId: "cosmetic-1", kind: "IMAGE",
    status: "published", version: 2, originalName: "frame.png",
    mimeType: "image/png", bytes: 4096, width: 256, height: 256,
    sha256: "abc123", stagingKey: "staging/frame.png", stagingUrl: "https://staging.test/frame.png",
    publicKey: "public/frame.png", publicUrl: "https://cdn.test/frame.png",
    createdBy: ADMIN, publishedAt: "2026-01-02T03:04:05Z",
    variants: [
      { name: "thumb", key: "public/frame_256.png", url: "https://cdn.test/frame_256.png", contentType: "image/png", bytes: 1024, width: 256, height: 256 }
    ]
  });
  const root = table(result, "assets")[0];
  const variant = table(result, "asset_variants")[0];
  assert.equal(result.rejected, false);
  assert.equal(root.source_id, ASSET_ID);
  assert.equal(root.status, "published");
  assert.equal(root.sha256, "abc123");
  assert.equal(root.public_url, "https://cdn.test/frame.png");
  assert.equal(variant.source_id, `${ASSET_ID}:variants:0`);
  assert.equal(variant.assets_id, ASSET_ID);
  assert.equal(variant.url, "https://cdn.test/frame_256.png");
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);

  const bad = map("assets", {
    _id: ASSET_ID, ownerType: "user", ownerId: "x", status: "published", version: 0,
    originalName: "x", mimeType: "image/png", bytes: 0, width: 0, height: 0,
    sha256: "", stagingKey: "k", stagingUrl: "u", createdBy: ADMIN
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "OUT_OF_RANGE", "OUT_OF_RANGE", "OUT_OF_RANGE", "OUT_OF_RANGE", "MISSING_REQUIRED"]);
});

test("new domain mappings are reachable through the registry", () => {
  for (const collection of [
    "admin_sessions", "device_tokens", "diamond_transactions", "purchases",
    "gift_transactions", "withdrawal_requests", "subscriptions", "assets"
  ]) {
    assert.equal(typeof getMapping(collection), "function", collection);
  }
});
