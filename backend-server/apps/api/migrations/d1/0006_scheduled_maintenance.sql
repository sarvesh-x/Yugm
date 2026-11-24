ALTER TABLE media_upload_sessions ADD COLUMN staging_cleaned_at TEXT;

-- Release quota with the terminal session transition, including during cancellation and expiry races.
CREATE TRIGGER release_media_upload_quota AFTER UPDATE OF quota_reserved ON media_upload_sessions
WHEN OLD.quota_reserved = 1 AND NEW.quota_reserved = 0
BEGIN
  UPDATE media_quota_reservations SET bytes = MAX(0, bytes - OLD.expected_bytes), updated_at = NEW.updated_at
    WHERE source_id = OLD.user_id;
END;

CREATE INDEX idx_media_staging_cleanup ON media_upload_sessions (expires_at, source_id)
  WHERE staging_cleaned_at IS NULL AND status IN ('CANCELLED', 'FAILED', 'EXPIRED', 'COMPLETED');
CREATE INDEX idx_stories_active_expiry ON stories (expires_at, source_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_clan_messages_retention ON clan_messages (created_at, source_id);
CREATE INDEX idx_clan_invites_pending_expiry ON clan_invites (expires_at, source_id) WHERE status = 'PENDING';
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions (expires_at, source_id);
CREATE INDEX idx_users_suspension_expiry ON users (suspended_until, source_id) WHERE suspended_until IS NOT NULL;
CREATE INDEX idx_users_vip_expiry ON users (vip_expires_at, source_id) WHERE vip_frozen = 0 AND vip_tier IS NOT NULL;
CREATE INDEX idx_users_vip_freeze_expiry ON users (vip_freeze_started_at, source_id) WHERE vip_frozen = 1;
CREATE INDEX idx_users_progression_rank ON users (level DESC, xp DESC, source_id) WHERE is_blocked = 0 AND deletion_requested_at IS NULL;
