ALTER TABLE room_mode_states ADD COLUMN scores TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(scores));
ALTER TABLE room_mode_states ADD COLUMN revision TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_mode_states_room ON room_mode_states (room_id);
