# Android source audit

**Date:** 2026-11-22  
**Status:** Phase 0 read-only static audit of `android-client`. No Gradle build, lint, unit/instrumented test, migration, deploy or live request was run. Prior test results quoted here are documented baselines, not current-audit evidence.

## 1. Current uncommitted state

The R2 avatar-upload slice is present in the working tree and is uncommitted: 10 modified files plus 2 untracked files (`MediaUploadApi.kt`, `MediaUploadApiTest.kt`). Modified files span `core:api` (`IYugmApi`, `RoomApi`, `YugmApi`, `YugmHttpClient`), `core:data` (`AuthRepository`), `feature:auth` (`AuthNavGraph`, `CreateProfileScreen`, `ProfileSetupViewModel`) and `feature:profile` (`ProfileDetailScreen`, `ProfileViewModel`). It is not provisioned, migrated or deployed. `git status --short` confirmed the same set; preserve this work.

## 2. Module graph

Authoritative source is `settings.gradle.kts` plus each `build.gradle.kts`:

- `app` depends on all modules.
- **6 core modules:** `core:api`, `core:model`, `core:ui`, `core:util`, `core:data`, `core:navigation`.
- **14 feature modules:** `auth`, `profile`, `room`, `chat`, `social`, `gift`, `wallet`, `missions`, `events`, `discover`, `creator`, `moderation`, `settings`, `room-modes`.
- Key edges: `core:api → core:model`; `core:ui → core:api, core:model, core:util`; `feature:chat → feature:social`. Several feature modules do not depend on `core:data` and call API singletons directly from composables.

## 3. Navigation and state ownership

- Single `NavHost` in `app/.../navigation/NavGraph.kt`; route catalog in `core:navigation/.../Screen.kt`; five-tab dock whitelist in `MainTabsRoutes.kt`; top-level targets in `TopLevelNavigation.kt`/`TopLevelNavigationTargets.kt`; 14 per-feature `*NavGraph.kt` files. Insets and dock visibility are centralized. No competing navigation system was found.
- 35 `*ViewModel.kt` files, 36 `@HiltViewModel` annotations. `UiState` (`core:util/.../UiState.kt`) has only `Idle`, `Loading`, `Success`, `Error(message, cause)` — no dedicated Offline or Empty variant.
- Hilt is minimal: `app/.../di/NetworkModule.kt` provides `IYugmApi = YugmApi`, plus `SessionManager`/`SocketManager` injection. `ApiConfig`, `YugmHttpClient`, `AppSync`, `ReactionCatalogCache`, `YugmApi`, `RoomApi` and most feature API clients are global Kotlin `object` singletons, not DI-managed. `SocketManager` is the notable Hilt `@Singleton`.
- **103 direct API calls across 32 `*Screen.kt`/`*NavGraph.kt` files** (`YugmApi` 74, `SocialApi` 23, `CreatorApi` 4, `VibeApi` 2; largest is `WalletNavGraph.kt` with 12). This bypasses the ViewModel/state-holder layer extensively and is a migration liability: contract changes cannot be contained behind a repository boundary.

## 4. Network layer

`core/api/.../YugmHttpClient.kt` centralizes:

- `isOnline` fail-fast with `IllegalStateException("No internet connection")` on all request paths (lines 129, 276, 365). Offline is not a typed state.
- Base failover across `baseCandidates` for safe-retry methods only; non-idempotent mutations use the preferred base.
- Account pinning (`checkAccount`/`RequestAccount`), token refresh on 401 with offline retention, 8-second timeout for `/auth/me`, and error context with request IDs for 5xx/422 (`ApiHttpException`).
- Firebase App Check header is added only on `/auth/*` and device-token routes — matching the narrow server-side application recorded in the [backend audit](backend-source-audit.md).
- New R2 path: non-logging `presignedClient`, `uploadToPresignedUrl()` and `ProgressRequestBody` (32 KB chunks, cancellation checks).

`ApiConfig.kt:22` `resolveMediaUrl()` converts API-relative paths (for example `/uploads/avatar.jpg`) to loadable URLs using the API origin. Absolute URLs, including R2 public URLs, pass through unchanged. The function is applied inconsistently across parsers (`FeedApi`, `EventsApi`, `ReferralApi`, `RoomApi`, and others), so some screens read raw `avatar` fields. Any hardcoded media host strings must be checked at cutover.

`shouldRequireAppCheck()` (`ApiConfig.kt:14`) permits a bypass only for debug builds against loopback hosts; remote/release builds always require it.

## 5. Realtime and sync

- `SocketManager.kt` is a Hilt `@Singleton` carrying app-wide DM, notification, clan, room-presence and `sync:invalidate` events as a typed `SocketEvent` sealed class over buffered `SharedFlow`.
- `YugmSocket.kt` (`RoomSocketClient`) uses `forceNew = true` and is lifecycle-scoped per room.
- `AppSync.kt` defines `SyncTopic` (ALL, ROOMS, CHAT, CLANS, PROFILE, WALLET, GIFTS, TASKS, NOTIFICATIONS, EVENTS, SOCIAL, SETTINGS, BONDS). `AutomaticSyncEffect.kt` drives bounded read-only refresh while a destination is visible (30-second default), with `LocalAutomaticSyncEnabled` suppressing neighboring pager tabs.
- Android has a `BONDS` topic that is not present in the server's `syncInvalidation.ts:5–26` topic list. Reconcile this mismatch before protocol work.
- Server-side, managed avatar completion emits `["PROFILE","TASKS"]`, legacy `/upload/avatar` emits `PROFILE`, and all other `/media/*` mutations are deliberately excluded from invalidation.

## 6. Media and asset rendering

- `YugmApplication.kt` implements `ImageLoaderFactory` with GIF/SVG/ImageDecoder support and initializes Firebase/App Check.
- `AssetArtwork.kt` (`selectAssetArtworkUrl`: named variant → `full` → direct URL; non-URL values ignored), `Avatar.kt`, `GeneratedAvatar`/`MultiAvatar`, `CosmeticArtwork.kt` and `CosmeticVisuals.kt` centralize asset-aware rendering and overlays. This is the correct reuse point for dynamic renderer metadata.
- No admin media/registry/quota UI exists: the admin app has no references to `media/uploads`, R2, presigned URLs or `MediaObject`. This is a wiring gap if R2 becomes authoritative.

## 7. Hardcoded catalog and business content

These are duplicated business rules: a server-side catalog/pricing/policy change currently requires an Android release. They are the primary hardcoded-content migration debt.

| File | Hardcoded content |
|---|---|
| `core:util/.../CosmeticNames.kt:3–118` | 114-entry `cosmeticNameMap`; `cosmeticDisplayName()` falls back to the raw ID. |
| `core:ui/.../SharedComponents.kt` | `CategoryChips()` catalog. |
| `feature:wallet/.../VipPlansScreen.kt:57` | `VipRequirements = listOf(0,1000,1500,2500,4000,6000,10000,25000)` and 16 tier-gated `VipBenefits`. |
| `feature:gift/.../GiftCatalogScreen.kt:46` | `boxPrices = {basic:500, premium:2000, luxury:10000}` plus local filters. |
| `feature:events/.../Festivals.kt` | `ALL_FESTIVALS` with emoji/accent. |
| `feature:events/.../EventCreateScreen.kt:59–60` | Event categories and types lists. |
| `feature:moderation/.../ReportScreen.kt` | 8 report categories. |
| `feature:moderation/.../FilteredInput.kt:18` | `CLIENT_BLOCKED_KEYWORDS` — advisory only; the server must remain authoritative. |
| `feature:profile/.../CosmeticsStoreScreen.kt`, `CustomizeProfileScreen.kt` | `storeCategories`, 12 `customizeCategoryTabs`. |
| `feature:settings/.../SettingsScreen.kt`, `SupportScreen.kt` | Policy copy and status colors. |
| `core:model/.../WalletModels.kt:73` | `coinToInrRate` default `0.01`. Nuance verified in source: `CreatorApi.kt:123` reads `coinToInrRate` from the server response with `0.01` as fallback, so this is a hardcoded fallback, not an exclusively client-authored rate. |

`ReactionCatalogCache.kt` is not a hardcoded catalog; it is a bounded 2-minute, 4-entry session cache (`DEFAULT_TTL_MS = 2*60*1000L`).

## 8. Auth, session and error behavior

- `core:data/.../SessionManager.kt` is the encrypted session cache and source of truth for `authToken`.
- `app/.../MainViewModel.kt` `validateStartupSession()` uses `withTimeout(10_000L)`; it clears the cached session only on definitive 401–403 excluding App Check failures, retains auth on transient/offline failures, and reconnects the socket in `finally`.
- `AuthViewModel.kt:410–464` maps 401 app-verification, another-device, Firebase, 409, 403 verify-email, `AppCheckSetupException`, Firebase error codes and network/timeout cases to user-facing messages.
- `MainActivity.kt` sets `YugmHttpClient.isOnline` from `NetworkCapabilities.NET_CAPABILITY_VALIDATED` and triggers `AppSync.onMutation` after successful non-GET writes.
- Loading/error use `UiState` or Compose `mutableStateOf` flags with shared `LoadingState`/`YugmLoadingSpinner`. Empty state is ad hoc per screen. Retry exists for room join, chat send, discover fallback and support operations; chat/room/discover/auth flows handle `CancellationException` correctly.

## 9. R2 avatar upload wiring gap

Verified source flow: `IYugmApi.kt` (`uploadAvatarWithProgress`, `cancelMediaUpload`) → `YugmApi.kt` → `RoomApi.uploadAvatarWithProgress`: prepare thumbnail → `MediaUploadApi.createAvatarSession` (`POST /media/uploads`, `category=AVATAR`) → `YugmHttpClient.uploadToPresignedUrl` (signed PUT, no logging) → `MediaUploadApi.completeAvatar` → returned URL → `setOwnAvatar`/`updateProfile`. Cancel is `DELETE /media/uploads/{sessionId}` via `AuthRepository.cancelMediaUpload`. Legacy multipart `/upload/avatar` is used only when session creation returns `503`/`501`.

Two gaps were verified directly:

- `ProfileDetailScreen.kt:202` reads only `viewModel.avatarUploadBusy`. It does not consume `avatarUploadProgress` or `activeAvatarUploadSessionId` and does not call `cancelOwnAvatarUpload()`; that API is dead from this screen. `CreateProfileScreen.kt:419–452` does wire progress, retry and Cancel correctly.
- `ProfileSetupViewModel.kt` and `ProfileViewModel.kt:154–160` populate `activeAvatarUploadSessionId` from the first progress callback only. Cancellation before that callback is a no-op, and a failed upload does not call server-side cancel, leaving the quota reservation until TTL. There is no server-side sweeper for orphaned reservations (see the [backend audit](backend-source-audit.md)).

## 10. Design-system reuse and duplication

Reusable primitives confirmed: `Avatar.kt`, `YugmLoadingSpinner.kt`, `AssetArtwork.kt`, `GlassComponents.kt`, `SharedComponents.kt` (`SectionTitle`, `LiveBadge`, `PrimaryButton`, `LoadingState`), `ReferenceComponents.kt`, `YugmBottomDock.kt`, `YugmGradientButton.kt` and theme tokens in `Color.kt`/`Type.kt`/`Theme.kt`.

Duplication to consolidate, not to multiply:

- `GlassCard` in `SharedComponents.kt:523` and `GlassComponents.kt:81` with different signatures/gradients.
- `LiveBadge` in `SharedComponents.kt:474` and a private copy in `VideoLivestreamScreen.kt:937`.
- Private `YugmTextField` in `ClanCreateScreen.kt:144` while a shared field exists.
- Raw `Color(0x...)` counts: room 267, profile 54, moderation 45, chat 35, social 26, wallet 25. New work must use the existing `:core:ui` theme tokens and bottom dock.

## 11. Test inventory and gaps

- 25 Kotlin unit test files under `src/test`: 12 in `core:api` (including new `MediaUploadApiTest.kt`), 4 in `feature:auth`, 3 in `core:ui`, 2 in `core:navigation`, 2 in `app`, and one each in `feature:chat`, `feature:profile`.
- Instrumented tests: `app/.../androidTest/OnboardingFlowTest.kt`, `ExampleInstrumentedTest.kt`, `feature:profile/.../BondCenterTest.kt`.
- `MediaUploadApiTest.kt` covers 5 cases: grant parsing, signed content-type fallback, unsafe URL rejection, progress body chunks, cancellation.
- Missing tests: `create`/`complete`/`cancel` HTTP protocol and error mapping; `503`/`501` legacy fallback and proof that post-grant failures are **not** retried against legacy; failed-upload cleanup and quota release; `ProfileSetupViewModel`/`ProfileViewModel` progress/token/cancel behavior including the pre-sessionId window; assertions for the `ProfileDetailScreen` gap; and parity of hardcoded catalog/policy values (VIP thresholds, box prices, coin/INR fallback) with server values.

## 12. Migration implications

- Keep the HTTP and Socket contracts stable for the old-client support window; additive response fields are safer than envelope changes because many callers parse JSON directly in composables.
- Move hardcoded catalogs, prices, eligibility and policy behind admin-controlled server config where the task requires server authority; keep `FilteredInput` advisory only.
- Replace direct composable→API singleton calls with repository/state-holder boundaries before domain cutovers so contracts have one client-side owner.
- Reconcile the `BONDS` sync topic mismatch and the narrow App Check application during the protocol decision.
- Fix the R2 `ProfileDetailScreen` wiring and failed-upload cleanup before expanding media categories.
- R2 public URL host changes will surface through `resolveMediaUrl`; audit inconsistent application and any hardcoded hosts at cutover.
- Consolidate duplicate UI primitives rather than adding a third copy; preserve the single-host navigation/dock contract.

No build, lint or test was executed in this audit. Nothing here establishes deployed behavior or current test results.
