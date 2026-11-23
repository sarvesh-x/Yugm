import assert from "node:assert/strict";
import { test } from "node:test";
import { decideMediaAccess, type MediaAccessActor, type MediaAccessSubject } from "./mediaAccessPolicy.js";

const media: MediaAccessSubject = {
  ownerType: "ROOM",
  ownerId: "room-1",
  visibility: "PRIVATE",
  processingStatus: "READY",
  moderationStatus: "APPROVED",
};

const actor = (overrides: Partial<MediaAccessActor> = {}): MediaAccessActor => ({
  userId: "actor",
  isMediaOwner: false,
  isResourceOwner: false,
  isResourceAdmin: false,
  isAcceptedParticipant: false,
  ...overrides,
});

test("public media is readable without a private-media grant", () => {
  const result = decideMediaAccess({ ...media, visibility: "PUBLIC" }, actor());

  assert.deepEqual(result, { allowed: true, decision: "public" });
});

test("media owner and resource owner are granted owner access", () => {
  assert.deepEqual(decideMediaAccess(media, actor({ isMediaOwner: true })), { allowed: true, decision: "owner" });
  assert.deepEqual(decideMediaAccess(media, actor({ isResourceOwner: true })), { allowed: true, decision: "owner" });
});

test("resource admins and accepted participants receive private access", () => {
  assert.deepEqual(decideMediaAccess(media, actor({ isResourceAdmin: true })), { allowed: true, decision: "resource-admin" });
  assert.deepEqual(decideMediaAccess(media, actor({ isAcceptedParticipant: true })), { allowed: true, decision: "participant" });
});

test("pending invites and platform-admin-only actors are denied", () => {
  const pending = decideMediaAccess(media, actor());
  assert.equal(pending.allowed, false);
  assert.equal(pending.decision, "deny");
});

test("block or hidden-for checks override every grant", () => {
  for (const flags of [{ isBlocked: true }, { isHiddenForActor: true }]) {
    const result = decideMediaAccess(media, actor({ isResourceOwner: true, ...flags }));
    assert.equal(result.allowed, false);
    assert.equal(result.decision, "deny");
  }
});

test("invalid media state is denied before authorization", () => {
  for (const patch of [
    { deletedAt: "2026-11-23T00:00:00.000Z" },
    { processingStatus: "FAILED" },
    { moderationStatus: "REJECTED" },
  ]) {
    const result = decideMediaAccess({ ...media, ...patch }, actor({ isMediaOwner: true }));
    assert.equal(result.allowed, false);
  }
});
