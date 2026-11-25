CREATE UNIQUE INDEX idx_assets_owner_version ON assets (owner_type, owner_id, version);
CREATE INDEX idx_assets_active_digest ON assets (owner_type, owner_id, sha256) WHERE status <> 'archived';
CREATE INDEX idx_assets_staging_lookup ON assets (staging_key) WHERE status <> 'archived';
