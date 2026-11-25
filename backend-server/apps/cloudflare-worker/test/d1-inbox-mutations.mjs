import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1InboxMutations(db, request, owner, peer, outsider) {
  const ownerId = owner.user.id;
  const peerId = peer.user.id;
  const [owned, reply, old, attachment, stranger] = Array.from({ length: 5 }, id);
  const seed = (key, sender, recipient, { at = new Date().toISOString(), media = "", replyTo = "" } = {}) =>
    db.prepare(`INSERT INTO direct_messages (source_id, sender_id, receiver_id, message, media_url, media_type,
      duration, forwarded, is_edited, read, created_at, updated_at, reply_to_message_id, reply_to_author,
      reply_to_text, reply_to_media_url) VALUES (?, ?, ?, 'Fixture message', ?, ?, 0, 0, 0, 0, ?, ?, ?, '', '', '')`)
      .bind(key, sender, recipient, media, media ? "IMAGE" : "", at, at, replyTo);
  await db.batch([
    seed(owned, ownerId, peerId), seed(reply, peerId, ownerId, { replyTo: owned }),
    seed(old, ownerId, peerId, { at: new Date(Date.now() - 16 * 60_000).toISOString() }),
    seed(attachment, ownerId, peerId, { media: "/api/media/private/fixture" }),
    seed(stranger, outsider.user.id, peerId)
  ]);
  const path = user => `/api/users/messages/${user}`;
  const as = (actor, to, endpoint, status, body, method) =>
    request(path(to) + endpoint, status, { accessToken: actor.accessToken, body, method });
  const edit = (actor, to, message, status) => as(actor, to, `/${message}`, status, { message: "Edited fixture" }, "PUT");
  const edited = await edit(owner, peerId, owned, 200);
  assert.equal(edited.data.message.isEdited, true);
  assert.equal(edited.data.message.message, "Edited fixture");
  await edit(peer, ownerId, owned, 404);
  await edit(owner, peerId, old, 400);
  await edit(owner, peerId, attachment, 400);
  const reaction = (type, status = 200) => as(peer, ownerId, `/${owned}/reactions`, status, { type });
  assert.equal((await reaction("wave")).data.message.reactions[0].type, "wave");
  assert.equal((await reaction("heart")).data.message.reactions[0].type, "heart");
  assert.equal((await reaction("heart")).data.message.reactions.length, 0);
  await reaction("vip_diamond", 403);
  await reaction("no_such_reaction", 400);
  const forwarded = await as(owner, outsider.user.id, "/forward", 201, { messageId: owned });
  assert.equal(forwarded.data.message.forwarded, true);
  assert.equal(forwarded.data.message.message, "Edited fixture");
  await as(owner, outsider.user.id, "/forward", 415, { messageId: attachment });
  await as(owner, outsider.user.id, "/forward", 404, { messageId: stranger });
  assert.deepEqual((await as(peer, ownerId, "/delete-selected", 200, { messageIds: [owned], scope: "EVERYONE" })).data.deletedIds, []);
  const hidden = await as(peer, ownerId, "/delete-selected", 200, { messageIds: [owned, owned], scope: "ME" });
  assert.deepEqual(hidden.data.deletedIds, [owned]);
  await reaction("heart", 404);
  await as(peer, outsider.user.id, "/forward", 404, { messageId: owned });
  await as(peer, ownerId, `/${owned}`, 404, undefined, "DELETE");
  await as(owner, peerId, `/${owned}`, 200, undefined, "DELETE");
  assert.equal(await db.prepare("SELECT reply_to_message_id FROM direct_messages WHERE source_id = ?")
    .bind(reply).first("reply_to_message_id"), "");
  const removed = await as(owner, peerId, "/delete-selected", 200, { messageIds: [old, attachment, reply], scope: "EVERYONE" });
  assert.deepEqual(new Set(removed.data.deletedIds), new Set([old, attachment]));
  assert.ok(await db.prepare("SELECT 1 FROM direct_messages WHERE source_id = ?").bind(reply).first());
}
