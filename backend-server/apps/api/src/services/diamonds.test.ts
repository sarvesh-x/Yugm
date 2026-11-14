import assert from "node:assert/strict";
import test from "node:test";
import { diamondPacks, diamondSourceLabels, diamondSources, findDiamondPack, sendGiftSchema } from "@yugm/shared";

test("diamond pack catalog has unique ids and Google Play products", () => {
  const ids = new Set(diamondPacks.map((pack) => pack.id));
  const products = new Set(diamondPacks.map((pack) => pack.googleProductId));
  assert.equal(ids.size, diamondPacks.length);
  assert.equal(products.size, diamondPacks.length);
  for (const pack of diamondPacks) {
    assert.ok(pack.diamondAmount > 0);
    assert.ok(pack.priceInr > 0);
    assert.equal(findDiamondPack(pack.id)?.googleProductId, pack.googleProductId);
  }
  assert.equal(findDiamondPack("unknown_pack"), undefined);
});

test("every diamond source has a display label", () => {
  for (const source of diamondSources) {
    assert.ok(diamondSourceLabels[source]);
  }
  assert.equal(new Set(diamondSources).size, diamondSources.length);
});

test("send gift schema accepts an optional diamond currency", () => {
  const base = { giftId: "64b000000000000000000001", receiverId: "64b000000000000000000002" };
  assert.deepEqual(sendGiftSchema.parse(base), base);
  assert.equal(sendGiftSchema.parse({ ...base, currency: "DIAMONDS" }).currency, "DIAMONDS");
  assert.equal(sendGiftSchema.parse({ ...base, currency: "COINS" }).currency, "COINS");
  assert.equal(sendGiftSchema.safeParse({ ...base, currency: "USD" }).success, false);
});
