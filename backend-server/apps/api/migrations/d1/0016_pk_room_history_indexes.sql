CREATE INDEX IF NOT EXISTS idx_pk_history_left_room ON pk_battles (left_room_id, created_at DESC, source_id DESC)
  WHERE status IN ('ENDED', 'FORCE_ENDED');
CREATE INDEX IF NOT EXISTS idx_pk_history_right_room ON pk_battles (right_room_id, created_at DESC, source_id DESC)
  WHERE status IN ('ENDED', 'FORCE_ENDED');
CREATE INDEX IF NOT EXISTS idx_pk_active_participants ON pk_participants (battle_id, side, joined_at, source_id)
  WHERE left_at IS NULL;
