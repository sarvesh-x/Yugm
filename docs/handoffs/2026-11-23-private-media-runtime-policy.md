# Handoff — Private-media runtime policy

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — apply accepted DCR-4 private-media rules in the API authorization boundary.

## Done

- Moved the pure policy to `backend-server/apps/api/src/services/mediaAccessPolicy.ts`; `migration/mediaAccessPolicy.ts` now re-exports it so the design harness and runtime cannot drift.
- `services/media.ts` resolves authoritative resource facts for `USER`, `MESSAGE`, `ROOM` and `CLAN` media and applies `decideMediaAccess()` before issuing a signed URL.
  - Room: host as resource owner; moderator/admin/co-host arrays as resource admins; active `RoomParticipant` rows and speakers as accepted participants.
  - Clan: owner as resource owner; LEADER/CO_LEADER/OFFICER roles as resource admins; `memberIds` as accepted participants.
  - Message: sender/receiver as accepted participants with hidden-for and two-way block checks.
  - Block checks against the resource owner also override room/clan grants.
- Added integration coverage for room and clan owner, admin, accepted participant, outsider and block denial.
- Updated ADR-0005, the private-media audit, DCR-4 decision request and progress docs.

## Verification performed

- Targeted media, migration-policy and integration tests — 21/21 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- No MongoDB outside the in-memory test server, R2 provider, credential, Cloudflare account or production data access. These changes are uncommitted.

## Important limitation

This change widens private access from the previous message-only rule to the owner-selected policy, but it is still gated by authoritative resource state at read time and does not issue persistent URLs. No R2 provisioning, media category cutover, Android client change or production deploy was performed.

## Remaining / next

1. Supply exact production origin/CORS and approve R2 provisioning.
2. Verify two-client media access on staging before any category cutover.
3. Complete Android progress/cancel wiring and admin mutation tooling in separate slices.
4. Commit/push of this slice requires separate explicit authorization.
