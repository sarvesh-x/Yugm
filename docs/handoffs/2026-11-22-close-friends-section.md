# 2026-11-22 - Profile close-friends section and three-person cap

> **Superseded by [2026-11-22-bonds-merge.md](2026-11-22-bonds-merge.md).** The separate close-friends UI, routes, API, service, tests, and `User.closeFriendIds` field were removed; Bonds are now the single inner-circle state. This record remains as historical implementation evidence.

## Scope

Redesign the own-profile Close friends area (empty, populated, unoccupied slots, and management) with an authoritative maximum of three close friends on both client and server. Keep the separate Bonds showcase reachable and visually distinct.

## Changes

- Android (`feature/profile/closefriends`): new `CloseFriendsSection` (own profile only) with `0/3`…`3/3` pill, compact icon, empty invitation, three equal slots, 50dp avatars, name/presence, brand-derived pastel cards, plus-slots, loading/error/retry, PROFILE/SOCIAL sync refresh, and Manage action.
- Android management: new `CloseFriendsScreen` + `CloseFriendsViewModel` with current circle, accepted-friend picker bottom sheet, remove confirmation, max-3 guard, action errors, and refresh after each authoritative mutation. Occupied cards open the member profile.
- Navigation: `Screen.CloseFriends` (`close_friends?pick={pick}`) registered in `profileNavGraph` and opened from `MainTabsScreen`/`ProfileDetailScreen`; dock hidden as a secondary destination; back returns to Profile.
- Bonds: profile showcase heading renamed to "Bonds" and Bonds screen hero to "My Bonds" so it is no longer confused with the new close-friends circle. Existing Bonds route/entry point preserved.
- Backend: shared `closeFriendsLimit = 3`; added `services/closeFriends.ts` decision helper; `POST /users/:id/close-friend` now requires an accepted friendship and no block, rejects self-add, atomically enforces the cap with a conditional `findOneAndUpdate`, returns 409 when full, and stays idempotent (no duplicate notification) for repeated adds; `GET /me/close-friends` and `/me/friends` now include transient `isOnline`.
- Tests: backend `closeFriends.test.ts` (4 cases); Android `CloseFriendsRulesTest` (7 cases) covering slot padding, candidate filtering/removal, and error mapping. Added `testImplementation(libs.junit)` to `feature:profile`.
- Docs: `API_CONTRACTS.md`, OpenAPI close-friend endpoints, `DESIGN_SYSTEM.md`, `COMPONENT_REGISTRY.md`, `NAVIGATION_MAP.md`, `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md`.

## Verification

- `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` - passed.
- `npm.cmd --workspace @yugm/api test` - 182/182 passed.
- Android Studio JBR, `--console=plain --max-workers=2`: `:core:navigation:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:profile:compileDebugUnitTestKotlin :app:compileDebugKotlin` - BUILD SUCCESSFUL; `:feature:profile:testDebugUnitTest --tests CloseFriendsRulesTest` - 7/7 passed; `:core:navigation:testDebugUnitTest` and `:app:testDebugUnitTest --tests MainTabsNavigationTest` - BUILD SUCCESSFUL.
- `git diff --check` - no whitespace errors (LF/CRLF notices only).

## Not verified / risks

- No device/emulator visual QA of card proportions, light/dark themes, font scaling, TalkBack, narrow screens, or realtime refresh after mutations in another client.
- No MongoDB integration test of the atomic 409 race; coverage is the pure decision helper plus server typecheck/full unit suite.
- OpenAPI paths were added by hand; no YAML parser was available locally for machine validation.
- Untracked local build logs were left untouched; committed and pushed as `76dbfe8`, with no deploy.

## Handoff

Runtime visual sign-off and an integration check of concurrent adds at the cap remain for the next session. The global spinner scale change is documented separately in `2026-11-22-loading-spinner-global-scale.md`.
