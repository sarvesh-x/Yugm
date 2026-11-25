import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Events(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const eventDate = new Date(Date.now() + 86_400_000).toISOString();
  const payload = () => ({
    title: "Fixture event",
    category: "Music",
    type: "PARTY",
    eventDate,
    maxParticipants: 1,
    tags: ["fixture"]
  });
  const cleanup = () => db.batch([
    db.prepare("DELETE FROM event_participants WHERE events_id IN (SELECT source_id FROM events WHERE host_id IN (?, ?))")
      .bind(ownerId, visitorId),
    db.prepare("DELETE FROM events WHERE host_id IN (?, ?)").bind(ownerId, visitorId),
    db.prepare("DELETE FROM notifications WHERE title = 'New event participant' AND user_id IN (?, ?)")
      .bind(ownerId, visitorId)
  ]);

  await cleanup();
  await request("/api/events", 401, { body: payload() });
  await request("/api/events/events", 401, { body: payload() });
  await request("/api/events/user/me", 401);
  for (const action of ["join", "leave", "cancel"]) {
    await request(`/api/events/not-an-id/${action}`, 401, { body: {} });
  }
  assert.equal((await request("/api/events", 422, {
    accessToken: owner.accessToken, body: { ...payload(), title: "ab" }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/events", 422, {
    accessToken: owner.accessToken, body: { ...payload(), type: "CONCERT" }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/events", 400, {
    accessToken: owner.accessToken, body: { ...payload(), roomId: "not-an-id" }
  })).error.message, "Invalid identifier");

  const created = await request("/api/events", 200, { accessToken: owner.accessToken, body: payload() });
  const event = created.data.event;
  assert.equal(event.title, "Fixture event");
  assert.equal(event.hostId, ownerId);
  assert.equal(event.eventDate, eventDate);
  assert.deepEqual(event.participantIds, []);
  assert.deepEqual(event.tags, ["fixture"]);
  assert.equal(event.maxParticipants, 1);
  assert.equal(event.status, "UPCOMING");
  assert.equal(event.festival, "none");
  assert.equal(event.featured, false);

  const listed = await request("/api/events?limit=50&upcoming=true", 200);
  const found = listed.data.events.find(({ _id }) => _id === event._id);
  assert.ok(found);
  assert.equal(found.hostId._id, ownerId);
  assert.deepEqual(found.participantIds, []);
  assert.ok((await request("/api/events/events?limit=50", 200)).data.events.some(({ _id }) => _id === event._id));
  assert.equal((await request("/api/events?type=NOPE", 200)).data.events.some(({ _id }) => _id === event._id), false);

  for (const path of [`/api/events/${event._id}`, `/api/events/events/${event._id}`]) {
    const detail = await request(path, 200);
    assert.equal(detail.data.event.hostId._id, ownerId);
    assert.deepEqual(detail.data.event.participantIds, []);
  }
  assert.equal((await request("/api/events/not-an-id", 400)).error.message, "Invalid identifier");
  assert.equal((await request(`/api/events/${id()}`, 404)).error.message, "Event not found");

  const joined = await request(`/api/events/events/${event._id}/join`, 200, {
    accessToken: visitor.accessToken, body: {}
  });
  assert.equal(joined.data.alreadyJoined, false);
  assert.deepEqual(joined.data.event.participantIds, [visitorId]);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM event_participants WHERE events_id = ?")
    .bind(event._id).first("count"), 1);
  const notification = await db.prepare(`SELECT user_id, type, title, body, data
    FROM notifications WHERE title = 'New event participant' AND user_id = ?`).bind(ownerId).first();
  assert.ok(notification);
  assert.equal(notification.type, "SYSTEM");
  assert.match(notification.body, /^.* joined your event "Fixture event"$/);
  assert.equal(JSON.parse(notification.data).eventId, event._id);

  const replay = await request(`/api/events/${event._id}/join`, 200, {
    accessToken: visitor.accessToken, body: {}
  });
  assert.equal(replay.data.alreadyJoined, true);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM event_participants WHERE events_id = ?")
    .bind(event._id).first("count"), 1);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
    WHERE title = 'New event participant' AND user_id = ?`).bind(ownerId).first("count"), 1);
  const full = await request(`/api/events/${event._id}/join`, 409, {
    accessToken: owner.accessToken, body: {}
  });
  assert.equal(full.error.message, "Event is full. Try again if a place becomes available.");

  const owned = await request("/api/events/user/me", 200, { accessToken: owner.accessToken });
  assert.ok(owned.data.hosting.some(({ _id }) => _id === event._id));
  assert.equal(owned.data.hosting.find(({ _id }) => _id === event._id).hostId, ownerId);
  const joinedBy = await request("/api/events/events/user/me", 200, { accessToken: visitor.accessToken });
  const joinedEvent = joinedBy.data.joined.find(({ _id }) => _id === event._id);
  assert.ok(joinedEvent);
  assert.equal(joinedEvent.hostId, ownerId);
  assert.deepEqual(joinedEvent.participantIds, [visitorId]);

  assert.equal((await request(`/api/events/${event._id}/cancel`, 404, {
    accessToken: visitor.accessToken, body: {}
  })).error.message, "Event not found or not your event");
  const cancelled = await request(`/api/events/${event._id}/cancel`, 200, {
    accessToken: owner.accessToken, body: {}
  });
  assert.equal(cancelled.data.event.status, "CANCELLED");
  assert.equal((await request(`/api/events/${event._id}/join`, 409, {
    accessToken: owner.accessToken, body: {}
  })).error.message, "Event is not open for joining");
  assert.equal((await request("/api/events?upcoming=true", 200)).data.events.some(({ _id }) => _id === event._id), false);
  const left = await request(`/api/events/${event._id}/leave`, 200, {
    accessToken: visitor.accessToken, body: {}
  });
  assert.equal(left.data.event.status, "CANCELLED");
  assert.deepEqual(left.data.event.participantIds, []);

  assert.equal((await request("/api/events/not-an-id/join", 400, {
    accessToken: owner.accessToken, body: {}
  })).error.message, "Invalid event ID");
  assert.equal((await request("/api/events/not-an-id/leave", 400, {
    accessToken: owner.accessToken, body: {}
  })).error.message, "Invalid event ID");
  assert.equal((await request("/api/events/not-an-id/cancel", 400, {
    accessToken: owner.accessToken, body: {}
  })).error.message, "Invalid identifier");
  await cleanup();
}
