# Handoff: Multiavatar SVG rendering repair and dialog redesign (continuation 17)

**Date:** 2026-11-20  
**Task:** YUGM-AVATAR-MULTI-009 (user-requested audit/repair/redesign of existing Multiavatar integration)  
**Branch/commit:** `master` at `6c43d6e` (no new commits). Working tree remains heavily modified/uncommitted with many unrelated whitespace-only tracked diffs from prior automated scripts plus untracked additions. Preserve unrelated work and review diffs carefully before commit.

## Implemented in this continuation

### 1) SVG rendering / decoder fixes (source)
- **`android-client/app/src/main/java/com/yugm/app/YugmApplication.kt`**: registered `coil.decode.SvgDecoder.Factory()` in the app `ImageLoader` components (Coil 2.7.0) alongside existing GIF/image decoders; added `coil-svg` dependency to `:app` (`app/build.gradle.kts`). This addresses the likely root cause of blank avatar previews/thumbnails and HWUI "Failed to create image decoder with message 'unimplemented'" when raw Multiavatar SVG bytes were decoded by platform bitmap decoders.
- **`android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/GeneratedAvatar.kt`**:
  - Uses shared default engine/cache (`MultiavatarEngine`, `AvatarCache(maxSize=256)`) to avoid per-call cache/engine allocation and repeated rendering.
  - Renders SVG bytes asynchronously on `Dispatchers.Default` with cache lookup/store, keyed by descriptor, cancellation-safe error handling, and non-blocking composition.
  - Builds `ImageRequest` with `ByteBuffer.wrap(bytes)`, explicit `decoderFactory(SvgDecoder.Factory())`, stable memory cache key (`descriptorKey:px`), disk cache disabled for generated content, target size, `allowHardware(false)`, `crossfade(false)`.
  - Adds lightweight placeholder/fallback container behavior and avoids blocking composition.

### 2) Avatar customization dialog redesign (source)
- **`android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/AvatarGeneratorDialog.kt`**: redesigned using Material3/Yugm theme tokens (`MaterialTheme.colorScheme`, `PrimaryPink/PrimaryPurple/SaffronGold` accents), compact layout, and `DialogProperties(usePlatformDefaultWidth = false)`:
  - Centered header/title/subtitle with close icon.
  - Prominent circular avatar preview with decorative gradient background and accent ring.
  - "Randomize all" action with shuffle icon.
  - Icon-based horizontal category selector (Hair/Face/Eyes/Mouth/Clothes/Background) with selected accent highlighting.
  - Category header with per-category shuffle and reset icons.
  - Responsive 4-column `LazyVerticalGrid` thumbnails (lazy composition), rounded tiles, accent border + checkmark for selected variant.
  - Fixed bottom primary "Use this avatar" button; dialog dismiss/close preserves previous selection (confirm only on primary action).
  - Shared engine/cache passed to preview and thumbnails to reduce repeated rendering/decoding.

### 3) Backend/account cleanup parity (from continuation 17 audit)
- **`backend-server/apps/api/src/routes/users.ts`**: account deletion/tombstone `$unset` now clears `avatarType` and `avatarParts` in addition to `avatar` to avoid stale generated-avatar descriptors on deleted users.

## Verification run

- **Android** (`android-client`, `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`):
  - `.\gradlew.bat :core:ui:compileDebugKotlin :app:compileDebugKotlin` — **BUILD SUCCESSFUL** (after fixes; app compile succeeded once coil-svg added to `:app`). Warnings observed in unrelated/profile code (existing deprecations).
  - Follow-up adjustments (cancellation-safe render, Coil memory-cache key / disk-cache policy) compiled: `:core:ui:compileDebugKotlin` and `:app:compileDebugKotlin` — **BUILD SUCCESSFUL** (final consistency check).
- **Backend**: `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` — **exit 0** (after users delete tombstone `$unset` fix).

## Not run (required by user request / plan; environment limits)

- **On-device/emulator verification:** complete flow not verified on Android device (profile creation + Edit Profile, all six categories, main preview/thumbnails rendering, Logcat/HWUI behavior, light/dark, small screens, a11y/font scale, reduced motion). This remains **required** before claiming decoder/rendering issues are fully resolved in runtime.
- Android tests/lint/release build, APK/AAB size measurement, performance/memory profiling.
- Backend tests/runtime/API/socket/migration/backward-compat verification.

## Remaining work / blockers

1. **Runtime/device validation (blocking for this repair request):** verify on device/emulator that SVG previews/thumbnails render correctly with no repeated `Failed to create image decoder` HWUI errors, all six categories work, thumbnails lazy-load/cache correctly, rapid customization has no stale previews, cancel preserves prior avatar, and confirm returns exact displayed descriptor in create/edit flows.
2. **Licensing/provenance (blocking, plan-level):** exact audited upstream `mew22/Multiavatar` source/commit/version and required Kotlin-port/original-artwork license/copyright notices not recorded/verified. Cannot be completed from current repo state without verified upstream source/license details.
3. **Systematic Multiavatar parity/quality gates:** end-to-end Android/backend/socket parity audit, semantics (auth/revision/conflict/idempotency where applicable), automated/golden tests, lint/release, visual/SVG/a11y QA, perf/size, migration/backward-compat.
4. **Diff hygiene:** separate intentional Multiavatar/fix changes from widespread unrelated whitespace-only diffs before commit.

## Notes

- No commits/pushes/deploys performed. Do not overwrite unrelated user/worktree changes.
- `AvatarGeneratorDialog` now dismisses via close icon/back/outside without a redundant Cancel button; reset is an icon action in the category header. Functional confirm/cancel semantics preserved.
