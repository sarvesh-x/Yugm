# Yugm Bonds

## Architecture and data

The existing relationship XP collection supports legacy dating matches and chat activity. Its existing records remain intact. Explicitly accepted Bestie and Soulmate connections use the additive `bonds` collection, with separate request, point, reward, and ranking snapshot collections. The server reuses accepted friendships, account safety rules, the shared gift catalog, the coin wallet and gift journal, notifications, and cosmetic ownership in Backpack. Android uses the existing profile feature module, Hilt, Compose, authenticated HTTP, and shared Socket.IO invalidation.

API startup applies the new model indexes through `ensureProductionIndexes` in both Node and the Worker. There is no backfill. The database requires transactions on a MongoDB replica set. Active pairs, pending pairs, per-sender request keys, point events, ranking snapshots, and rewards have unique indexes. Slot numbers are stored with the active bond or pending sender request. Transactions write the same user documents before checking occupancy so parallel operations cannot allocate the same slot. Existing active connections always require explicit consent.

The default slot limit is three across both bond types. `YUGM_BOND_SLOTS` sets a limit from 1 to 12. Keep the configured limit at least as high as existing allocations unless a slot migration is planned. Invitations are valid for 24 hours. The server checks the deadline before accepting or reserving another slot and the existing maintenance job closes expired requests. An invitation can also be declined or cancelled. Closing, blocking, or removing a user releases unsettled holds and occupied slots. Starting again creates a new bond ID and date.

## Coins, gifts, and progression

Free invitations are available. Paid gifts use coins so they work on Yugm’s existing staging wallet. The debit journal records a `BOND_HOLD` when a paid invitation is sent. The funds leave the sender’s available balance immediately. Acceptance verifies the hold and settles the gift transaction and recipient share in the same transaction as activation. The sender is charged once. A non-accepted request returns the exact amount with a `BOND_RELEASE` entry. The platform fee follows Yugm’s existing gifting policy. A pending or returned hold does not award gift, charm, or bond progression. The dedicated Bonds gift catalog is managed in the existing Gift collection and seeded with insert-only defaults. Ordinary gift endpoints exclude bond-only gifts.

Users can check in once per UTC day. Completing a reciprocal check-in grants ten shared points once. Confirmed gifts earn configured points with a shared 300-point daily cap. Levels use the thresholds in `bondRules.ts`. Milestones run from the UTC activation instant using whole elapsed days and are recorded once. Gift support counts confirmed coin value once per committed gift transaction and is separate from non-financial activity. Ending a bond is free and preserves settled gift earnings and permanent rewards.

Rankings require both members to opt in and set visibility to Public. They cover activity, confirmed gift support, and active duration, with weekly, calendar-month, and calendar-quarter windows in UTC. The weekly window starts Monday. The service snapshots the last completed window with a stable order on score and bond ID. Reward journal keys make retries safe. Top three weekly activity bonds and the top monthly and seasonal activity bond earn a seven-day Bonds Champion frame. A shared milestone unlocks the permanent Shared Memories badge. Earned cosmetics are bound to each recipient’s Backpack and can be equipped through the existing cosmetic endpoints. Expiration removes the temporary item when its last active grant ends. Visibility changes suppress public cards and rankings independently of cosmetic ownership.

## Authenticated API

Endpoints are under `/api/bonds`. Responses use Yugm’s standard envelope. Only participants can read full bond details or history. A public profile response can include permitted active cards with the more restrictive of both members’ privacy settings. When Friends only applies, the viewer must be an accepted friend of both members. Blocked viewers are excluded. Pending or ended invitations are kept private. Personal invitation text follows the existing message moderation path.

| Method and path | Behavior |
| --- | --- |
| GET `/me` | Slot capacity, balance, active bonds, pending requests, ended history, and preferences |
| GET `/eligible-friends?q=` | Accepted friends eligible to receive a new request, with optional search |
| GET `/gift-catalog` | Server IDs, prices, points, gift purposes, and eligibility |
| GET `/profile/:id` | Authorized profile cards and invitation availability |
| POST `/invitations` | Request with `recipient`, `kind`, `slot`, `key`, optional `giftId` and `message` |
| POST `/invitations/:id/accept\|decline\|cancel` | Resolve once, with participant authorization and eligibility rechecked on acceptance |
| GET `/:id` | Participant detail, progress, milestones, preferences, and recent activity |
| PATCH `/:id/preferences` | Participant visibility, duration, level, badges, ranking opt-in and reminders |
| PUT `/invitation-settings` | Update invitation allowance with `enabled` or bond push delivery with `push` |
| POST `/:id/check-in` | Record readiness for the reciprocal UTC check-in |
| POST `/:id/gifts` | Send an eligible progression gift using `giftId` and an idempotency `key` |
| POST `/:id/type-change` | Request a new type with `kind` and `key`, then use invitation resolution |
| POST `/:id/end` | Either participant can end immediately |
| GET `/leaderboards` | Filter by `category` (ACTIVITY, SUPPORT, LONGEST), `window` (WEEK, MONTH, SEASON), `period` (current, previous), and optional `kind` |

The server emits `bonds:changed` to authorized participants only. It carries a timestamp and may carry an event ID and state version. It is an invalidation, so clients fetch scoped state rather than replaying private response bodies. Android refreshes on reconnect and app resume. Durable notifications are created with the transaction, and delivery happens after commit. Push and in-app notification taps open Relationship Center. Disabling bond push preserves the private in-app request and notification.

## Validation and rollout

Run these from `backend-server`:

```sh
npm run typecheck
npm --workspace apps/api run test:hardening
npm --workspace apps/cloudflare-worker run dry-run:staging
npm --workspace apps/cloudflare-worker run test:realtime
```

From `android-client`, run `./gradlew :app:assembleDebug testDebugUnitTest`. To exercise the complete flow on Android, sign in with two disposable staging accounts with an adult profile age. Accept a friendship, open Close friends from the profile, invite with a seed gift, inspect the sender's reserved balance, and accept in Relationship Center on the other device. Check that the bond exists on both devices, is private until both opt in, and earns points after both check in. End it and verify that both slots are available. Repeat with a declined paid invitation to confirm the hold is restored.

Local Node enables Bonds by default outside production. The Workers staging configuration enables `YUGM_BONDS_ENABLED` and uses the existing isolated MongoDB and Durable Object maintenance scheduler. The production default is off. Use the existing `master` staging workflow for deployment and the verified isolated staging credentials already installed there. For a pause, disable the feature flag and keep the compatible backend running so the expiry job can release open holds. Preserve the new collections and existing financial ledgers during a rollback.

The Android hero was generated with the built-in image tool. Its prompt was an original moonlit conservatory with curved glass arches, a reflecting pool, lavender wisteria, dusk-pink blossoms, and muted rose-gold highlights. The packaged artwork is `android-client/feature/profile/src/main/res/drawable-nodpi/bonds_garden.png`.

