# 2026-11-26 — Relationship level-up copy

## Scope
User-domain follow-up after client alignment: make relationship XP level-ups distinct from Bond level-ups. Local code and verification only; no migration, hosted operation, deploy or commit.

## Findings
- `d1Dating.ts` (match creation) and `d1RelationshipAward.ts` (message, gift and room-DM XP) both sent a "Relationship level up!" notification whose body said **"Your bond reached Level N"**. The actual Bond system also sends "Your bond reached a new level", so the two different progression tracks produced effectively identical copy.
- The tracked D1 uniqueness gaps in `CURRENT_TASK.md` were stale: `0039_gift_inventory_unique.sql` already adds `gift_inventories(user_id, gift_id)` and `0040_creator_trust_withdrawal_unique.sql` already adds the KYC-user, active-withdrawal-lock and trust-verification indexes. `auth-worker.mjs` already asserts those index names and the partial predicate.

## Changes
- `apps/api/src/services/relationshipPresentation.ts`: new `relationshipLevelNotice(level, title)` returning the single copy source: title "Relationship level up!", body "Your relationship reached Level N: Title."
- `apps/api/src/migration/d1RelationshipAward.ts`: uses the helper for award-triggered level-ups.
- `apps/api/src/migration/d1Dating.ts`: uses the helper for match-triggered level-ups; notification `data` is unchanged.
- `apps/cloudflare-worker/test/relationship-level-notice.mts` (new, wired into `test:domain`): calls `prepareRelationship` with a collector and asserts both partner notices, the title and the Level 2 body.
- `apps/cloudflare-worker/test/d1-dating.mjs`: asserts the persisted notification bodies for the Level 2 match and the seeded Level 3 upgrade.
- `docs/CURRENT_TASK.md`: corrected the two stale uniqueness claims and recorded this slice.

## Verification actually run
- `npm run typecheck` — all workspaces pass.
- `npm run test:domain` — 4/4 pass.
- `npm run test:d1-worker` — 3/3 pass, including the dating fixture.

## Notes
- The first dating-fixture run failed a blanket `/bond/i` check because the relationship tier at Level 3 is literally named **"Warm Bond"**. The assertion now checks the disambiguated "Your relationship reached" prefix instead, which is the actual regression guard.
- Bond notification copy and payloads were not changed.
- No hosted migration was applied (0042 remains unapplied), and no deploy or commit was performed.
