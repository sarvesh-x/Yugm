CREATE TABLE "pk_battles_0037" (
  source_id TEXT PRIMARY KEY,
  "battle_code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('GIFT', 'VOTE', 'REACTION', 'MIXED')),
  "format" TEXT NOT NULL CHECK ("format" IN ('PLAYER', 'TEAM', 'ROOM', 'LIVESTREAM')),
  "scope" TEXT NOT NULL CHECK ("scope" IN ('SAME_ROOM', 'CROSS_ROOM')),
  "team_size" INTEGER NOT NULL CHECK ("team_size" >= 1),
  "status" TEXT NOT NULL CHECK ("status" IN ('INVITED', 'WAITING', 'PREPARING', 'READY', 'COUNTDOWN', 'ACTIVE', 'FINAL_CRUNCH', 'OVERTIME', 'FINALIZING', 'COMPLETED', 'CLOSED', 'ABORTED', 'ENDED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'FORCE_ENDED')),
  "battle_type" TEXT NOT NULL CHECK ("battle_type" IN ('VOICE', 'VIDEO')),
  "duration_seconds" INTEGER NOT NULL CHECK ("duration_seconds" >= 30),
  "selected_gift_id" TEXT REFERENCES "gifts"("source_id"),
  "in_room_battle" INTEGER NOT NULL,
  "state_version" INTEGER NOT NULL CHECK ("state_version" >= 1),
  "event_sequence" INTEGER NOT NULL CHECK ("event_sequence" >= 0),
  "countdown_ends_at" TEXT,
  "finalized_at" TEXT,
  "closed_at" TEXT,
  "result_type" TEXT CHECK ("result_type" IN ('WIN', 'DRAW', 'FORFEIT', 'CANCELLED', 'TECHNICAL')),
  "termination_reason" TEXT NOT NULL,
  "started_by_user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "left_room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "right_room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "left_host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "right_host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "left_score" INTEGER NOT NULL CHECK ("left_score" >= 0),
  "right_score" INTEGER NOT NULL CHECK ("right_score" >= 0),
  "winner_side" TEXT CHECK ("winner_side" IN ('LEFT', 'RIGHT', 'DRAW')),
  "winner_user_id" TEXT REFERENCES "users"("source_id"),
  "started_at" TEXT,
  "ended_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

INSERT INTO "pk_battles_0037"
  (source_id, battle_code, title, mode, format, scope, team_size, status, battle_type,
   duration_seconds, selected_gift_id, in_room_battle, state_version, event_sequence,
   countdown_ends_at, finalized_at, closed_at, result_type, termination_reason,
   started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id,
   left_score, right_score, winner_side, winner_user_id, started_at, ended_at,
   created_at, updated_at)
SELECT source_id, battle_code, title, mode, format, scope, team_size, status, battle_type,
       duration_seconds, selected_gift_id, in_room_battle, state_version, event_sequence,
       countdown_ends_at, finalized_at, closed_at, result_type, termination_reason,
       started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id,
       left_score, right_score, winner_side, winner_user_id, started_at, ended_at,
       created_at, updated_at
FROM "pk_battles";

DROP TABLE "pk_battles";
ALTER TABLE "pk_battles_0037" RENAME TO "pk_battles";

CREATE INDEX IF NOT EXISTS "idx_pk_history_left_room" ON "pk_battles" ("left_room_id", "created_at" DESC, "source_id" DESC)
  WHERE status IN ('ENDED', 'FORCE_ENDED');
CREATE INDEX IF NOT EXISTS "idx_pk_history_right_room" ON "pk_battles" ("right_room_id", "created_at" DESC, "source_id" DESC)
  WHERE status IN ('ENDED', 'FORCE_ENDED');
