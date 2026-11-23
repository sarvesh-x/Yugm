# ADR-0005 — R2 media cutover scope and policy

**Date:** 2026-11-23
**Status:** Accepted; decision gate complete. Runtime provisioning, wiring fixes and category cutover remain separate gated work.
**Decision request:** DCR-4 in [decision-request.md](../cloudflare-migration/decision-request.md).

## Decision

Adopt **Option B — phased category cutover**:

1. Keep the five existing bucket names and server-derived keys from `backend-server/apps/api/src/services/r2.ts`: `assets`, `public-media`, `private-media`, `originals` and `staging`.
2. Use **public variants and private originals**: published variants may use public R2 URLs; staging objects and originals stay private and are delivered only through short-lived signed grants after authorization.
3. Private media access is granted to:
   - the media/resource owner;
   - resource admins (room host/moderator/admin, clan admin or conversation admin);
   - accepted participants (users who accepted an invite and are active room/clan/conversation participants).
   Platform-admin-only override is **not** part of this decision. Block and hide-for checks still deny access.
4. Use explicit per-environment domains/CORS allowlists. The known staging admin origin may be used for staging; production origin must be supplied by the owner. Wildcard production CORS is not accepted.
5. The agent stages local admin media/registry/quota tooling and value-free config guards. Provider credentials and final provisioning remain owner-controlled.

## Alternatives considered

- **Option A:** extend the avatar-only slice. Rejected because it defers the unresolved private-media categories indefinitely.
- **Option C:** full cutover in one phase. Rejected because private-media authorization and admin tooling are not yet implemented or verified.
- **All media private:** rejected; published variants are intended for public CDN delivery.
- **Pending invites permitted:** rejected; only accepted participants receive private access.

## Consequences

- Each media category needs its own validation and rollback gate before cutover; no single big-bang switch.
- The current runtime media service still grants non-owner private access only to direct-message participants. The accepted policy is encoded in a local, unwired harness at `backend-server/apps/api/src/migration/mediaAccessPolicy.ts` and must be implemented before private room/clan/category cutover.
- Admin media/registry/quota tooling must be staged locally and reviewed before it can be deployed.
- Exact production domain/CORS origin is still a provisioning input; no value is inferred here.
- Legacy `/uploads` references remain a separate inventory and recovery problem; this ADR does not make missing binaries recoverable.

## Non-goals

- No R2 provisioning or credential change.
- No media binary migration, deletion or archive operation.
- No runtime authorization change; the policy harness is not imported by the API.
- No Android cutover, client release or production deploy.

## Local contract foundation

`backend-server/apps/api/src/migration/mediaAccessPolicy.ts` is a pure policy harness with 6 passing tests. It covers public metadata, owner/resource-owner grants, resource admins, accepted participants, pending-invite denial, block/hide override and invalid media state. It does not grant access by itself.
