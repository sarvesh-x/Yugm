CREATE TABLE direct_message_reactions_catalog (
  source_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(source_id),
  type TEXT NOT NULL CHECK (length(trim(type)) BETWEEN 1 AND 64),
  created_at TEXT NOT NULL,
  direct_messages_id TEXT NOT NULL REFERENCES direct_messages(source_id),
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (direct_messages_id, user_id)
);

INSERT INTO direct_message_reactions_catalog (source_id, user_id, type, created_at, direct_messages_id, position)
SELECT source_id, user_id, type, created_at, direct_messages_id, position
FROM (
  SELECT *, row_number() OVER (PARTITION BY direct_messages_id, user_id ORDER BY created_at DESC, position DESC, source_id DESC) AS latest
  FROM direct_message_reactions
) WHERE latest = 1;

DROP TABLE direct_message_reactions;
ALTER TABLE direct_message_reactions_catalog RENAME TO direct_message_reactions;
CREATE INDEX idx_direct_message_reactions_parent ON direct_message_reactions (direct_messages_id, position);
