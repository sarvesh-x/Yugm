CREATE INDEX IF NOT EXISTS idx_reports_target_recent ON reports (target_user_id, created_at DESC, source_id DESC);
CREATE INDEX IF NOT EXISTS idx_reports_room_recent ON reports (room_id, created_at DESC, source_id DESC);
CREATE INDEX IF NOT EXISTS idx_reports_recent ON reports (created_at DESC, source_id DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_report ON moderation_queues (report_id);
