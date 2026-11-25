CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_referral_code" ON "users" ("referral_code");
CREATE INDEX IF NOT EXISTS "idx_referrals_referrer" ON "referrals" ("referrer_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_referred_user_status" ON "referrals" ("referred_user_id", "status");
