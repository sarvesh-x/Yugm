CREATE TABLE IF NOT EXISTS relationship_room_dm_xp_daily (
  pair_key TEXT NOT NULL,
  day TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (pair_key, day)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_recent ON chat_messages (room_id, created_at DESC, source_id DESC);
