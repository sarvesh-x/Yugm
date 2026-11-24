CREATE INDEX IF NOT EXISTS idx_clan_chat_history ON clan_messages (clan_id, created_at DESC, source_id DESC);
CREATE INDEX IF NOT EXISTS idx_clan_chat_member ON clan_members (clans_id, value);
CREATE INDEX IF NOT EXISTS idx_clan_chat_member_role ON clan_member_roles (clans_id, user_id, position, source_id);
