CREATE INDEX IF NOT EXISTS idx_polls_room_recent ON polls (room_id, created_at DESC, source_id DESC);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_user ON poll_votes (polls_id, value);
CREATE INDEX IF NOT EXISTS idx_polls_open_created ON polls (created_at, source_id) WHERE is_active = 1;
