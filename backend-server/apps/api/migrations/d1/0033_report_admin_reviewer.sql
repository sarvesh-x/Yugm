ALTER TABLE reports ADD COLUMN reviewed_by_admin_id TEXT REFERENCES admin_users(source_id);
