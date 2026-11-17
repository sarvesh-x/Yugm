# Referral index rollout preflight

The H2 application fix serializes new referral claims on the claimant's User record and commits referral status, referredBy, both rewards and both journal entries in one transaction. It does not change production indexes automatically.

Existing `Referral` declares a unique `referralCode` index. A referrer's code is intentionally reusable across different referred users, so this old constraint blocks a second claimant. It is retained as a known rollout blocker until a read-only historical-data review and explicit index migration are approved. New code returns a stable conflict and rolls back every financial/domain write if this old constraint prevents a claim.

Before migration, inspect a sanitized restored replica-set database:

1. List actual `referrals` indexes; do not infer deployed options from model declarations.
2. Aggregate non-null `referredUserId` with status COMPLETED/REWARDED and group by claimant. Report every claimant with more than one claim without deleting/merging rows.
3. Reconcile historical COMPLETED referrals and their corresponding wallet journals. The older invalid ledger source could leave partial financial state; never automatically award them again.
4. Verify every new claim path uses the transaction and conditional referredBy lock; check legacy scripts/clients for alternative writers.
5. Rehearse an additive partial unique referredUserId index with an explicitly agreed status/data policy; retain a nonunique referralCode lookup index. Only after that gate should the legacy unique referralCode index be removed and model declarations changed in coordination.
6. Prove two different users can claim one code, while parallel same-user claims produce only one reward pair, including lost-ACK retries. Rehearse rollback that stops new claims and preserves every committed record.

No index migration, historical record repair, balance adjustment or production query is part of this change. Do not deploy a new automatic uniqueness declaration over unreviewed production data.
