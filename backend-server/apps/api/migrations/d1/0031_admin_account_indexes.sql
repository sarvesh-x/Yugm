CREATE UNIQUE INDEX idx_admin_users_email_normalized ON admin_users (lower(email));
CREATE UNIQUE INDEX idx_admin_users_firebase_uid ON admin_users (firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE UNIQUE INDEX idx_admin_users_invitation_token ON admin_users (invitation_token_hash) WHERE invitation_token_hash IS NOT NULL;
CREATE INDEX idx_admin_sessions_refresh_token ON admin_sessions (admin_id, refresh_token_hash);
