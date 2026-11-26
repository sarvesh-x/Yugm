CREATE UNIQUE INDEX IF NOT EXISTS "idx_gift_inventories_user_gift"
  ON "gift_inventories" ("user_id", "gift_id");
CREATE INDEX IF NOT EXISTS "idx_gift_inventories_tradable_user"
  ON "gift_inventories" ("tradable", "user_id");
