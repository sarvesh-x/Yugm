import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { createSyncInvalidation, mutationTopics } from "./syncInvalidation.js";

test("sync invalidation excludes reads, passive acknowledgements and provider/auth routes", () => {
  for (const [method, path] of [["GET", "/api/rooms"], ["POST", "/api/auth/login"], ["POST", "/api/livekit/token"], ["POST", "/api/users/messages/person/read"], ["POST", "/api/notifications/device-token"]]) {
    assert.deepEqual(mutationTopics(method, path), []);
  }
  assert.ok(mutationTopics("POST", "/api/notifications/read-all").includes("NOTIFICATIONS"));
  assert.ok(mutationTopics("POST", "/api/users/messages/person").includes("CHAT"));
});

test("avatar upload invalidates the actor profile while other upload routes stay excluded", () => {
  assert.deepEqual(mutationTopics("POST", "/api/upload/avatar"), ["PROFILE", "TASKS"]);
  assert.deepEqual(mutationTopics("POST", "/api/upload/profile-media"), []);
  assert.deepEqual(mutationTopics("POST", "/api/upload/cover"), []);
});

test("only successful authenticated responses invalidate and publish no mutation payload", () => {
  const privateEvents: unknown[][] = [];
  const publicEvents: string[][] = [];
  const middleware = createSyncInvalidation((...args) => { privateEvents.push(args); }, (...args) => { publicEvents.push(args); });
  for (const status of [200, 403, 500]) {
    const response = Object.assign(new EventEmitter(), { statusCode: status });
    middleware({ method: "POST", originalUrl: "/api/rooms/room/join", user: { id: "actor" }, body: { secret: "must not be broadcast" } } as any, response as any, () => {});
    assert.equal(privateEvents.length, status === 200 ? 0 : 1);
    response.emit("finish");
  }
  assert.equal(privateEvents.length, 1);
  assert.equal(privateEvents[0][0], "actor");
  assert.equal(privateEvents[0][1], "sync:invalidate");
  assert.deepEqual(publicEvents, [["ROOMS"]]);
  assert.equal(JSON.stringify(privateEvents).includes("secret"), false);
});

test("experience badge updates sync profile and task readers", () => {
  assert.deepEqual(mutationTopics("PUT", "/api/experience/badges/showcase"), ["TASKS", "PROFILE"]);
  assert.deepEqual(mutationTopics("POST", "/api/experience/achievements/claim"), ["TASKS", "PROFILE"]);

  const recipients: string[] = [];
  const broadcasts: string[][] = [];
  const middleware = createSyncInvalidation((id) => { recipients.push(id); }, (...topics) => { broadcasts.push(topics); });
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  middleware({ method: "PUT", originalUrl: "/api/experience/badges/showcase", user: { id: "actor" } } as any, response as any, () => {});
  response.emit("finish");
  assert.deepEqual(recipients, ["actor"]);
  assert.deepEqual(broadcasts, [["PROFILE"]]);
});

test("wallet and clan updates stay scoped to the authenticated actor", () => {
  const recipients: string[] = [];
  const broadcasts: string[] = [];
  const middleware = createSyncInvalidation((id) => { recipients.push(id); }, (...topics) => { broadcasts.push(...topics); });
  for (const path of ["/api/wallet/withdraw", "/api/clans/private-clan/messages"]) {
    const response = Object.assign(new EventEmitter(), { statusCode: 200 });
    middleware({ method: "POST", originalUrl: path, user: { id: "actor" } } as any, response as any, () => {});
    response.emit("finish");
  }
  assert.deepEqual(recipients, ["actor", "actor"]);
  assert.deepEqual(broadcasts, []);
});
