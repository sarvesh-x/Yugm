CREATE INDEX IF NOT EXISTS idx_room_activity_room_type ON room_activities (room_id, type);
CREATE INDEX IF NOT EXISTS idx_room_active_participant ON room_participants (room_id, user_id) WHERE left_at IS NULL;
