-- Legacy Purchase indexes that the generated initial schema did not translate.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_purchases_provider_token"
  ON "purchases" ("provider", "purchase_token") WHERE "purchase_token" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_purchases_provider_order"
  ON "purchases" ("provider", "provider_order_id") WHERE "provider_order_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_purchases_user_created"
  ON "purchases" ("user_id", "created_at" DESC);
