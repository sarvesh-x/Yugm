CREATE INDEX IF NOT EXISTS idx_gifts_active_price ON gifts (coin_price, source_id)
  WHERE is_active = 1 AND category <> 'bonds';
CREATE INDEX IF NOT EXISTS idx_gift_inventory_owner ON gift_inventories (user_id, created_at, source_id);
