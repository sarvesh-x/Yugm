CREATE UNIQUE INDEX IF NOT EXISTS "idx_creator_payout_kycs_user"
  ON "creator_payout_kycs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_creator_payout_kycs_kyc_status"
  ON "creator_payout_kycs" ("kyc_status");
CREATE INDEX IF NOT EXISTS "idx_creator_payout_kycs_payout_status"
  ON "creator_payout_kycs" ("payout_status");
CREATE INDEX IF NOT EXISTS "idx_creator_payout_kycs_kyc_status_submitted_at"
  ON "creator_payout_kycs" ("kyc_status", "submitted_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_withdrawal_requests_active_lock"
  ON "withdrawal_requests" ("user_id")
  WHERE "active_lock" = 1;
CREATE INDEX IF NOT EXISTS "idx_withdrawal_requests_user_created"
  ON "withdrawal_requests" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_withdrawal_requests_status"
  ON "withdrawal_requests" ("status");

DROP INDEX IF EXISTS "idx_trust_verifications_user";
CREATE UNIQUE INDEX "idx_trust_verifications_user"
  ON "trust_verifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_trust_verifications_status_submitted"
  ON "trust_verifications" ("status", "submitted_at" DESC);
