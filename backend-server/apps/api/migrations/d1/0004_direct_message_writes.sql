-- Keep the shared relationship award cap across concurrent requests and restarts.
CREATE TABLE IF NOT EXISTS relationship_message_xp_daily (
  pair_key TEXT NOT NULL,
  day TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (pair_key, day)
);

CREATE INDEX IF NOT EXISTS idx_xp_daily_caps_user_event_day ON xp_daily_caps (user_id, event, day);
CREATE INDEX IF NOT EXISTS idx_user_safety_statuses_user ON user_safety_statuses (user_id);
