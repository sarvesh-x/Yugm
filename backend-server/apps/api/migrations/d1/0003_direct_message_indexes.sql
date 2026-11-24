-- Keep conversation and inbox reads scoped to the participating accounts.
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_receiver_page
  ON direct_messages (sender_id, receiver_id, created_at DESC, source_id DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_sender_page
  ON direct_messages (receiver_id, sender_id, created_at DESC, source_id DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread
  ON direct_messages (receiver_id, sender_id) WHERE read = 0;
CREATE INDEX IF NOT EXISTS idx_conversation_mutes_owner_partner
  ON conversation_mutes (owner_id, partner_id);
CREATE INDEX IF NOT EXISTS idx_relationships_pair
  ON relationships (pair_key, source_id);
