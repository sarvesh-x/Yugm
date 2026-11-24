# Local D1 Profile/social reads and writes

**Status:** implemented in the working tree, locally verified, **not committed or pushed**. The normal Node API, staging and production paths are unchanged. MongoDB remains authoritative; hosted D1 still has zero tables and no data was migrated.

## Scope

The loopback D1 Worker previously covered Auth, Profile, avatars, cosmetics, clans, inbox, room discovery and wallet reads. This slice adds the missing Android Profile/social operations:

| Route | Behavior |
| --- | --- |
| `GET /api/users/me/friends` | Accepted friendships for the signed-in actor, newest first, capped at 100. Uses the compact person projection that matches the legacy route. |
| `GET /api/users/:id/friends` | Accepted friendships for a visible user, newest first, capped at 100. Uses the same compact projection. |
| `GET /api/users/me/blocked` | Users blocked by the actor, newest first. |
| `POST /api/users/:id/follow` | Guarded D1 follow insert, actor/target counter increments, target notification and one-time `FOLLOW_USER` XP with its daily cap. |
| `DELETE /api/users/:id/follow` | Removes the actor's follow, guarded counter decrements and an `UNFOLLOW` notification to the former target. |
| `DELETE /api/users/me/followers/:id` | Removes a follower of the actor and guarded counter decrements. |
| `POST /api/users/:id/block` | Idempotent block row insertion after actor/target validity checks. |
| `DELETE /api/users/:id/block` | Removes the actor's block row. |

`GET /api/friends` keeps the richer projection (`bio` and `isVerified`) used by that legacy route. The two `/users/.../friends` routes intentionally keep the compact projection; they do not expose those fields.

Follow writes revalidate the HTTP actor inside the D1 batch. The insert claims the exact actor state, visible target, absent follow edge and daily XP total; all counter, notification, XP, Battle Pass, wallet and cap writes are guarded by the inserted follow's `source_id`. Replays reuse the stored `xp_grants` receipt and award no additional XP. Unfollow and follower removal use the removed edge as their guard so concurrent stale state cannot decrement counters twice.

Self-targeting is rejected for follow, follower removal and block. Unauthenticated calls are rejected before any write. A target that exists but is blocked, deleted or otherwise invisible returns `403`; a missing target returns `404`.

## Deliberate gap

The legacy `POST /api/users/:id/block` calls `blockBondPair()`, which terminates active and pending Bonds and publishes a `BONDS` invalidation. The D1 Worker has no Bonds router, so this slice only writes the `blocks` row and does not terminate Bonds or emit realtime invalidation. Do not treat D1 block parity as complete until that slice exists. Chat writes and conversation reads are also still missing from D1.

## Files

- `backend-server/apps/api/src/migration/d1Social.ts` — new D1 routes, XP grant, guarded writes and notifications.
- `backend-server/apps/api/src/migration/d1App.ts` — mounts the social router (from the preceding slice).
- `backend-server/apps/cloudflare-worker/test/d1-endpoints.mjs` — friends reads, follow/unfollow, replay and daily-cap state, counters, follower removal, block/unblock, blocked list and actor-scope assertions.

## Verification (run)

From `backend-server/`:

- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — **1/1 passed**. The fixture now covers the new routes and caught two implementation defects that were fixed: one surplus D1 binding in the actor read and notification rows addressed to the actor instead of the target.
- `npm.cmd run test:production-worker --workspace @yugm/cloudflare-worker` — **1/1 passed**.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed.
- `npm.cmd run audit:d1-endpoints` — legacy **638**, D1 **94**, shared **90**, legacy-only **548** distinct method/path patterns. The eight new patterns are this slice.
- `git diff --check` — clean.

## Not run / remaining

No full backend `npm test`, Android build or JVM test, live Firebase/App Check/FCM, RealtimeKit, hosted D1/R2, migration application, deploy, commit or push was performed. Remote D1 schema, capacity and recovery gates remain open.

Next: add D1 chat writes/conversation reads and the Bonds termination/invalidation side of block, then verify the remaining user and social patterns before any cutover. Do not deploy, provision, migrate, remove MongoDB or touch production data without new explicit authorization.
