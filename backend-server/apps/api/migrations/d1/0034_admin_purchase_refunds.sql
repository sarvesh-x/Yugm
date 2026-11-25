CREATE TABLE admin_purchase_refunds (
  source_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(source_id),
  admin_id TEXT NOT NULL REFERENCES admin_users(source_id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'REFUNDED', 'FAILED')),
  asset_currency TEXT NOT NULL CHECK (asset_currency IN ('COINS', 'DIAMONDS')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  ledger_id TEXT,
  provider_refund_id TEXT,
  provider_attempted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_admin_purchase_refunds_active ON admin_purchase_refunds (purchase_id) WHERE status <> 'FAILED';
CREATE INDEX idx_admin_purchase_refunds_purchase ON admin_purchase_refunds (purchase_id, created_at);
