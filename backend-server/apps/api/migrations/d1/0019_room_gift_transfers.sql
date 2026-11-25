CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_sender_idempotency
  ON gift_transactions (sender_id, json_extract(metadata, '$.idempotencyKey'))
  WHERE json_type(metadata, '$.idempotencyKey') = 'text';
CREATE TABLE IF NOT EXISTS relationship_gift_xp_daily (
  pair_key TEXT NOT NULL,
  day TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (pair_key, day)
);
