# Production implementation progress

The D1 migration status is maintained separately from this legacy production audit baseline. [Current D1 coverage and cutover status](../handoffs/2026-11-25-d1-route-coverage-checkpoint.md)

Current review baseline: `b1e8241`, plus the user's existing uncommitted reaction, room and chat changes. Work branch: `codex/production-current-baseline`.

The original audit at `300826a` remains historical evidence. It is not an accurate list of everything still missing in the current repository. The earlier wallet/gift containment work is already present at the current baseline and has not been reapplied. Existing user edits were preserved; this continuation changes separate backend event/payment paths and the isolated regression harness.

## Current implementation coverage

| Blueprint / findings | Current state | Evidence / remaining gate |
|---|---|---|
| H1 / GIFT-001, GIFT-002 | Unsafe legacy combo-charge and immediate bilateral-trade paths contained | HTTP and service regressions confirm refusal without asset mutation. Full authenticated consent/offer/acceptance UX remains unimplemented; these commands deliberately remain unavailable. |
| H2 / WALLET-001 | Balance and journal share transactions; source/units validated before mutation | Existing 100-identical-credit, overspend, ledger failure, outer workflow, theme/referral concurrency tests still pass. Subscription/bundle/level-reward outer workflow atomicity and historic reconciliation require further work. |
| GIFT-003, GIFT-004 | Room gift ledger keys scoped to transfer/leg; room replay input compared | Real HTTP tests cover two senders reusing a key, changed payload, price changes and repeated intent. Direct gifts/other creators and durable Android operation IDs still need the F1 protocol. |
| ENTITLEMENT-001 | Theme purchase/equip policies implemented | Existing HTTP ownership/host/free-theme checks pass. Full entitlement race/revocation testing remains. |
| EVENT-001 | Canonical Android routes and legacy aliases wired | Production mounts `/api` and `/api/events` for the same event router; regression fixture uses that order before broad authenticated routers. Original routes remain supported. |
| EVENT-002 | Atomic event capacity, idempotent join and atomic leave | 20 users compete for one seat: one accepted, nineteen rejected; winner retries without extra seat. Concurrent join/leave preserves all unrelated memberships; host-only cancellation tested. Event invitations, reminders, privacy/block policy, lifecycle and durable fanout remain separate E1/R1 work. |
| PAYMENT-001 | Refund state cannot be overwritten by provider verification/credit paths | `markPurchasePaid` conditionally accepts only eligible states; `creditPurchase` accepts PAID or returns an already credited result. Refund-pending/refunded/refund-failed are rejected. Client Razorpay/Google and admin verification avoid stale status saves. Signed delayed capture/failure fixtures and 30 concurrent credits pass. Real provider sandbox/refund races/reconciliation still NOT VERIFIED. |
| M1/A1 new chat UI/cache | User work preserved and reviewed as a new baseline | New optimistic bubbles, chat interactions, memory conversation cache and reaction access improvements exist. A memory cache is not a durable account-scoped pending-command store. Stable send identity, reconnect tombstones and read-ack recovery remain required. |
| R1 / AND-005 | Connection interference fixed; device navigation verification pending | Room Modes now uses its own lifecycle-owned RoomSocketClient and never replaces/disconnects the active-room singleton. Forced independent Socket.IO managers prevent transport sharing. Two offline transport regressions pass; real-device repeated navigation/background/account-switch checks remain. |
| F2 / socket session parity | Still open | Current session revocation/expiry, suspension and blocked typing behavior needs shared authorization enforcement and negative transport tests. |
| C1 | Still open | Authoritative ringing/accept/end/device ownership, private-video permissions and lifecycle tests remain required. |
| O1/T1 / market launch | NOT READY | No isolated restore drill, live schema/data audit, provider sandbox, supported-device call/process-death verification or measured SLO evidence supplied. These are not inferred from successful builds. |

## Changes in this continuation

- `eventRegistration.ts`: one conditional update enforces capacity/status, avoids repeated membership, and removes membership with `$pull` rather than saving an old participant list.
- `events.ts`: uses actual registration service; notification failure does not turn an accepted registration into a failed command. Listing has bounded positive pagination and deterministic tie breaking. Durable notification outbox remains outstanding.
- `app.ts`: preserves the old `/api/events/events` paths and adds Android's `/api/events` contract.
- `purchaseState.ts`, `purchaseCredit.ts`: conditional payment transitions; transactional credit with safe replay and driver conflict retry; no credit from refund/unverified states.
- `wallet.ts`, `admin.ts`, `paymentWebhook.ts`: remove verification paths that could save stale PAID/FAILED state over refund or credited records. An uncaptured Razorpay result no longer marks a purchase paid.
- Integration runner: isolated, fixed test webhook secret for local signed fixtures only; no real provider credentials or external datastore used.

## Actual validation

- `npm run typecheck` in `backend-server`: admin, API and shared TypeScript checks passed.
- `npm run test` in `backend-server/apps/api` with local test-only environment: **151 passed**.
- `npm run test:hardening`: **23 passed** against a temporary loopback MongoDB 8.2.6 replica set, including financial rollback, authorization, replay, capacity, join/leave, paid-theme and signed provider-callback cases. Purchase-journal fault injection rolls back fulfillment and a subsequent retry credits once.
- First event test failed because the test app mounted a router-wide auth boundary before the public event routes. Corrected the fixture to match production middleware order; all event regressions then passed.
- Android `:app:compileDebugKotlin`: **passed** against the current working tree, including the user's pending Android changes (5m 56s). This is not real-device or UI validation.

No production database query, schema/index migration, real purchase/refund, deployment or APK release was performed. No historic journal/balance was repaired. The legacy unique referral-code index still requires the explicit preflight described in `referral-index-migration.md`.

## Next implementation priorities

1. Account-scoped durable messaging identities/local queue and reconnect revision/tombstone recovery; preserve the user's new chat UX.
2. Shared socket authorization and independent room/mode listeners; call-state/private-video/OS lifecycle correctness.
3. Direct gift replay, remaining multi-entity wallet flows, explicit trade consent, financial reconciliation and durable outbox.
4. Event block/privacy/invitation/lifecycle policies and durable reminders/cancellation delivery.
5. Source and device accessibility/theme/navigation review against the current UI, then non-production performance, provider sandbox, backup/restore and compatibility gates.

The full blueprint is not complete. No release-readiness or launch certification is claimed by this progress record.

## Room Modes lifecycle continuation

- `core/api/.../YugmSocket.kt` now provides an instantiable RoomSocketClient while preserving the existing YugmSocket singleton for active-room callers. Each client owns its socket, callbacks and synchronization. Replaced connections cannot run late connect/ack callbacks on the new socket.
- RoomModesViewModel owns and disposes its own client, including onCleared. Reconnect/join acknowledgement refreshes canonical mode state. RoomModeHostScreen keys lifecycle effects by both token and room ID so refreshed identity replaces the old connection.
- This deliberately uses a separate connection while Modes is open; it is not a complete shared account connection manager or durable event replay implementation. Existing server authorization policy is unchanged. No server/data migration or API change.
- Validation: `:core:api:testDebugUnitTest --tests com.yugm.app.core.api.RoomSocketClientTest :app:compileDebugKotlin` passed. Both regressions run the real callback-registration/cleanup code with offline fake transports: closing Modes preserves room updates; replacing one owner's connection clears only that owner's old callbacks and repeated cleanup is safe. No network/provider call is needed by these tests.
- The user's pending room/chat/reaction edits were left untouched. No production deployment or APK release. Real-device media/navigation and remaining R1/F2/C1 gates remain NOT VERIFIED.
