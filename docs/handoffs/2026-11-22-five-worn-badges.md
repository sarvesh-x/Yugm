# 2026-11-22 - Five worn badges in the profile header

## Scope and decisions

A badge is an earned cosmetic. Placing a badge in a showcase slot means the user is wearing it. Worn badges are now capped at five and appear as a centered horizontal row of badge icons on the profile header, immediately under the ID/level label and above the description, on both own and public profiles. The **Your Yugm → Achievements** shortcut remains; the former own-profile **Achievements & badges** card and the separate public **Badges** card are not restored.

The server remains authoritative: selection capacity, earned/active validation, duplicate rejection, persistence, and public reads stay in the API. Clients treat `capacity` as server-sourced data and use five only as an offline/older-API fallback.

## Changes

- **`backend-server/apps/api/src/services/badges.ts`:** `maxWornBadges = 5`; used for automatic wear, stored `showcasedBadgeIds`, and public badge slicing.
- **`backend-server/apps/api/src/routes/experience.ts`:** badge gallery and public showcase responses include `capacity`. Showcase body validation uses the shared cap.
- **`backend-server/apps/api/src/middleware/syncInvalidation.ts`:** `/experience/...` mutations map to `TASKS` (and the standard `PROFILE`) instead of falling through to `SOCIAL`; badge showcase mutations also broadcast a topic-only `PROFILE` invalidation so other clients viewing that profile re-read its badges.
- **`android-client/core/model/.../CommonModels.kt`:** `BadgeGallery.capacity` with `FALLBACK_CAPACITY = 5`.
- **`android-client/core/api/.../CreatorApi.kt` / `AppSync.kt`:** parse capacity and map badge mutations to `TASKS`.
- **`android-client/core/ui/.../BadgeArtwork.kt`:** `WornBadgeRow` accepts a capacity instead of hard-coding three.
- **`android-client/feature/social/.../AchievementsScreen.kt`:** server-sized five-slot showcase, guarded picker/dialog actions, and rules copy describing the profile-header row.
- **`android-client/feature/profile/.../ProfileDetailScreen.kt`:** loads badges for own and public profiles, passes them to `ProfileHero`, renders the shared row in the requested position, and removes the old public Badges card.
- **Tests:** backend hardening badge case expanded to six earned badges; sync invalidation unit test added; Android `AppSyncTest` badge-mapping test added.
- **Docs:** API contracts, realtime events, design system, component registry, progression contract, OpenAPI, current task, and development progress updated.

## Verification

- Backend: `npm.cmd --workspace @yugm/api run typecheck` — exit 0.
- Backend: `npm.cmd --workspace @yugm/api test` — 179/179 passed.
- Backend: `npm.cmd --workspace @yugm/api run test:hardening` — 34/34 passed, including `badge gallery grants qualifying levels once, caps automatic wear at five, and preserves an unwear choice`.
- Android Studio JBR, `--console=plain --max-workers=2`: `:core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:ui:compileDebugKotlin :feature:social:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin :core:api:testDebugUnitTest` — BUILD SUCCESSFUL. Core API test XML: 30/30 passed, including `badgeShowcaseMutationsRefreshProfileAndTasks`.
- `git diff --check` — clean.

## Not verified / next session

- No device/emulator visual QA of the header row: five-icon spacing, narrow screens, light/dark/system themes, font scaling, TalkBack labels, and image-loading/error fallback.
- No live two-client realtime check after a badge wear change; only invalidation routing and scoped re-read contracts were unit/integration tested.
- Full lint/assemble and OpenAPI YAML parser validation were not run.
- Committed and pushed as `10cf4d7`; no deploy was performed.
