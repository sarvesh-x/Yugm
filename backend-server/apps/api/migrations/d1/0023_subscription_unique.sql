CREATE UNIQUE INDEX IF NOT EXISTS "idx_subscriptions_subscriber_creator" ON "subscriptions" ("subscriber_id", "creator_id");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_subscriber_active" ON "subscriptions" ("subscriber_id", "active");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_creator_active" ON "subscriptions" ("creator_id", "active");
