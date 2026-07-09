import assert from "node:assert/strict";
import test from "node:test";
import { rankPkOpponents } from "./pkMatch.js";

test("PK auto-match ranks same category and language first", () => {
  const ranked = rankPkOpponents(
    { category: "Music", language: "Hindi" },
    "room-a",
    [
      { roomId: "room-b", hostId: "host-b", category: "Gaming", language: "English", participantCount: 400 },
      { roomId: "room-c", hostId: "host-c", category: "Music", language: "Hindi", participantCount: 25 },
      { roomId: "room-d", hostId: "host-d", category: "Music", language: "English", participantCount: 200 }
    ]
  );

  assert.equal(ranked[0].roomId, "room-c");
  assert.equal(ranked[1].roomId, "room-d");
});

test("PK auto-match excludes the caller room", () => {
  const ranked = rankPkOpponents(
    { category: "Chill", language: "Tamil" },
    "room-a",
    [
      { roomId: "room-a", hostId: "host-a", category: "Chill", language: "Tamil", participantCount: 999 },
      { roomId: "room-b", hostId: "host-b", category: "Chill", language: "Tamil", participantCount: 10 }
    ]
  );

  assert.deepEqual(ranked.map((item) => item.roomId), ["room-b"]);
});
