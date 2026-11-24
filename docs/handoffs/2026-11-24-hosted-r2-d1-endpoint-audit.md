# Hosted R2 verification and D1 endpoint audit

The owner approved the existing hosted R2 buckets for pre-release use. Android debug still targets the loopback Worker with local bindings. The release build targets the configured production HTTPS origin. [Build configuration](../features/release-build-configuration.md)

## R2 bindings

| Worker binding | Hosted Standard bucket |
| --- | --- |
| `ASSETS` | `yugm-assets` |
| `PUBLIC_MEDIA` | `yugm-public-media` |
| `PRIVATE_MEDIA` | `yugm-private-media` |
| `ORIGINALS` | `yugm-originals` |
| `STAGING` | `yugm-staging` |

Wrangler confirmed Standard as the default storage class for each bucket. A remote smoke test wrote one temporary marker per bucket, read back identical bytes and deleted every marker. The managed-media flag is enabled in `wrangler.production.jsonc`. Set `YUGM_R2_ENABLED=false` to pause managed media. R2 Standard usage above the monthly included allowances is metered. [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

The production origin, Firebase credentials, JWT signing and media grant secret remain setup inputs. The production Worker was bundled and exercised with simulated bindings. Hosted R2 object operations were verified directly. The later D1 slice set the hosted database identifier. Verification of the deployed Worker against hosted D1 and R2 remains open. [D1 binding and readiness](2026-11-24-d1-database-and-redis-boundary.md)

## Endpoint coverage

From `backend-server`, run `npm.cmd run audit:d1-endpoints` for counts or `npm.cmd run audit:d1-endpoints -- --missing` for the legacy methods and paths still missing. The script inspects the real Express route stacks without listening or connecting to a database. It also accounts for the D1 Worker routes handled directly by its fetch entry point. It counts distinct method/path patterns, including aliases. Runtime tests provide behavior evidence separately.

| Legacy API patterns | D1 Worker patterns | Shared patterns | Legacy-only patterns |
| ---: | ---: | ---: | ---: |
| 638 | 69 | 65 | 573 |

The table records the audit for this 20-route slice. A later 2026-11-24 Profile/social slice re-ran the same audit: legacy **638**, D1 **94**, shared **90**, legacy-only **548** distinct method/path patterns. See [the Profile/social handoff](2026-11-24-d1-profile-social-writes.md).

The shared Worker added 20 legacy API operations in this slice.

- Rooms gained public discovery, scheduled and trending lists, search, recommendations, followed rooms, room and host rankings, detail, follower listing, follow and unfollow, chat history and activity. Private room follower lists require permission to view the room. Public host rankings keep wallet balance as a tie-breaker and omit the value from the response.
- Notifications gained App Check-protected device-token registration and removal. Registration is idempotent for the owner and another account cannot remove the token. Push delivery via Firebase remains a separate part of the migration.
- Wallet gained coin pack and VIP plan reads, account-scoped transaction history, and a daily reward claim that commits the ledger and balance atomically. Replays return the same daily-claim outcome without another credit.
- The Arcade catalog exposes the existing D1 score projection through the normal Worker route and shares its response presenter with the legacy API.

The missing list at this checkpoint included 215 admin, 47 user, 46 room, 16 Bonds and 9 clan patterns. The later Profile/social slice reduced the user total to 32. Room lifecycle and realtime delivery, direct and clan messaging, the remaining cosmetics administration and payments are still open. The production RealtimeKit client has mock coverage from the prior slice. Android RTC and live provider verification remain open. [Production setup and RTC work](2026-11-24-production-cloudflare-builds.md)

## Verification

- `npm.cmd test` passed 551 backend tests across API, admin and shared packages.
- `npm.cmd run test:hardening --workspace @yugm/api` passed 34 tests with disposable local infrastructure.
- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both Worker suites, including the new endpoints, room access and concurrent follows, daily-claim replay, device ownership and the R2 pause switch.
- `npm.cmd run typecheck`, `npm.cmd run audit:d1-endpoints`, `npm.cmd run secrets:check:strict` and `git diff --check` passed.

This slice did not deploy the Worker, apply remote D1 migrations, or release an Android build. Live Firebase/App Check, FCM, RealtimeKit, Android end-to-end checks and remote API acceptance remain open. Use the missing-route inventory to plan the next migration slices and verify each through the Worker before switching app traffic.
