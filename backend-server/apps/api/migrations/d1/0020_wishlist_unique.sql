CREATE UNIQUE INDEX IF NOT EXISTS "idx_wishlist_user_gift" ON "wishlist_items" ("user_id", "gift_id");
