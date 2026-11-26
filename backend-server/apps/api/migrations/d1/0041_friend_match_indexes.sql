CREATE UNIQUE INDEX IF NOT EXISTS "idx_friend_match_requests_user"
  ON "friend_match_requests" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_friend_match_requests_status"
  ON "friend_match_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_friend_match_requests_status_created_expires"
  ON "friend_match_requests" ("status", "created_at", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_friend_match_requests_expires_at"
  ON "friend_match_requests" ("expires_at");
