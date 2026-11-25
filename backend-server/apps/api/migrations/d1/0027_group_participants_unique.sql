CREATE UNIQUE INDEX IF NOT EXISTS "idx_conversation_participants_group_value"
  ON "conversation_participants" ("group_chats_id", "value") WHERE "value" IS NOT NULL;
