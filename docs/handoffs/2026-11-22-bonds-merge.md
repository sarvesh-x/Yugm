# 2026-11-22 - Unified Bonds profile section

## Scope and decisions

Merge the separate Close Friends feature into Bonds: the own profile shows one three-slot **Bonds** section backed by `/bonds/me`, using the same capacity used for adding people. Bonds remain authoritative for consent/invitations, gifts, levels, Relationship Center, and realtime invalidation. The user chose **Bonds is authoritative** and approved **removing** the legacy close-friends API/storage as a breaking change.

## Changes

- **Profile UI (`feature/profile/bonds`):** `ProfileBondsSection` is now the single own-profile card. It reads `/bonds/me`, shows an `active/capacity` pill, occupied/pending/empty slots, empty invitation, loading spinner, retryable error, and Manage. Occupied/pending slots open the Bonds flow at that partner; empty slots open Bonds home. Other users keep the existing public bond showcase. Added `BondsProfileRules.kt` (`profileBondSlots`, `activeBondCount`) and `BondsProfileRulesTest` (4 cases).
- **Bonds flow:** `Screen.Bonds` keeps its original `bonds?partner={partner}&center={center}` route. `partner` and `center` behavior is unchanged, and explicit invite targets still use the existing invite flow; opening Bonds from the profile does not auto-open a search/invite sheet. Removed `Screen.CloseFriends`, its nav composable, ProfileDetail/MainTabs callbacks, and the `closefriends` package/tests.
- **Android API/model:** removed `closeFriends`, `addCloseFriend`, `removeCloseFriend` from `IYugmApi`, `UserApi`, and `YugmApi`. Renamed `Host.closeFriendsCount` to `bondsCount` and updated `RoomParser`.
- **Backend API:** removed `GET /users/me/close-friends`, `POST /users/:id/close-friend`, `DELETE /users/:id/close-friend`, shared `closeFriendsLimit`, `services/closeFriends.ts` and its tests. `users.ts` now derives `bondsCount` from active `Bond` rows and `isBonded` from an active caller-target bond; `PATCH /me` returns authoritative `bondsCount`. Removed `User.closeFriendIds` from the schema/type and the `$pull` in `blockBondPair`. OpenAPI replaced the removed paths with `/bonds/me`, `/bonds/eligible-friends`, and `/bonds/invitations`.
- **Docs:** API contract, design system, navigation map, Bonds guide, `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md`; the prior close-friends handoff is marked superseded. The global spinner-scale task is separate and unaffected.

## Verification run

- Backend: `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` exit 0; `npm.cmd --workspace @yugm/api test` 178/178 passed (previous total 182 included 4 now-deleted close-friend tests).
- Android (Android Studio JBR, `--console=plain --max-workers=2`, `--no-configuration-cache`): `:core:navigation:compileDebugKotlin :core:api:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:profile:compileDebugUnitTestKotlin :app:compileDebugKotlin` BUILD SUCCESSFUL.
- Android tests: `:feature:profile:testDebugUnitTest --tests BondsProfileRulesTest` 4/4; `:core:navigation:testDebugUnitTest` 12/12; `:app:testDebugUnitTest --tests MainTabsNavigationTest` 4/4. All BUILD SUCCESSFUL. A final `:feature:profile:compileDebugKotlin` recheck after the stale-error-state fix also passed.
- `git diff --check` clean apart from pre-existing LF/CRLF notices.

## Follow-up fix (same day)

- **Card width:** the profile Bonds card was 16dp narrower on each side than sibling profile cards because `GlassCard`/`BondSection` added horizontal padding inside a `LazyColumn` that already applies 16dp content padding. Profile states now use `GlassCard(Modifier.fillMaxWidth())` or the shared `ProfileBondSectionCard`, matching sibling cards.
- **No auto invite sheet:** removed the `slot` route argument, nav argument, callbacks, and `initialSlot` effect. Add bond/plus cards now open Bonds home (`Screen.Bonds.createRoute()`), where the user invokes Invite explicitly. The original `partner` flow for explicit invite targets (chat/room/other profile) is unchanged.
- **Re-verification:** Android Studio JBR `:core:navigation:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin` BUILD SUCCESSFUL; `:feature:profile:testDebugUnitTest --tests BondsProfileRulesTest` 4/4, `:core:navigation:testDebugUnitTest` 12/12, `:app:testDebugUnitTest --tests MainTabsNavigationTest` 4/4.

## Not verified / next session

- No device/emulator visual QA: slot proportions, full card width against sibling cards, light/dark themes, font scaling, TalkBack, narrow screens, opening Bonds from the profile, or realtime refresh in a second client.
- MongoDB concurrent-slot integration was not rerun; the existing `productionHardening.integration.ts` capacity case remains the source-level coverage. No migration/backfill was run for legacy `closeFriendIds` data.
- OpenAPI paths were edited by hand; no YAML parser was available locally. Full lint/assemble was not run.
- `docs/production/endpoint-inventory.csv` and `schema-inventory.csv` are dated baselines and still list the removed routes/field as historical evidence; they were not regenerated.
- Untracked local build logs were left untouched. Nothing was committed, pushed, or deployed.
