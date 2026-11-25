CREATE INDEX IF NOT EXISTS idx_room_invites_room_recipient_status
  ON room_invites (room_id, invitee_id, status, inviter_id, created_at DESC, source_id DESC);
