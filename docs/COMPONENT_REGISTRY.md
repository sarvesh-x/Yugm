# Shared component registry

This is a source-location index, not a guarantee that every screen uses these components consistently. Shared Compose components currently live in `android-client/core/ui/src/main/java/com/yugm/app/core/ui/components/`.

| Component or family | Source | Purpose / notes |
|---|---|---|
| `BrandHeader`, `AuthShell` | `SharedComponents.kt` | Brand and auth layout |
| `SearchBar`, `CategoryChips`, `Chip`, `ChipWrap` | `SharedComponents.kt` | Discovery filters/search affordance |
| `RoomCarousel`, `RoomCard` | `SharedComponents.kt` | Room discovery presentation |
| `Avatar` | `Avatar.kt` | Shared avatar presentation; supports uploaded/default images and generated Multiavatar descriptors (`avatarType`/`avatarParts`) when provided |
| `AvatarLiveIndicator` | `AvatarLiveIndicator.kt` | Live state decoration |
| `GlassComponents` | `GlassComponents.kt` | Branded glass surfaces |
| `RoomShell` | `RoomShell.kt` | Room screen shell |
| `GiftPanel` | `GiftPanel.kt` | Gift interaction UI |
| `PkComponents` | `PkComponents.kt` | PK presentation |
| `ControlButton` | `ControlButton.kt` | Room/media control affordance |
| `ChallengeCard` | `ChallengeCard.kt` | Challenge presentation |
| `SlimLineFrame` | `SlimLineFrame.kt` | Decorative frame |
| `YugmBottomDock` / `YugmDockTab` / `YugmBottomDockDefaults` | `ReferenceComponents.kt` | Centralized main bottom navigation: floating adaptive capsule (60dp) for Yugm Arcade/Party/Discover/Chat/Profile. Inactive tabs icon-only; active tab shows icon + compact label with expanding indicator; supports select/reselect callbacks, chat unread badge/count semantics, theme-aware styling, reduced-motion-aware animation, and reserved-content padding constant (`ReservedContentPaddingAboveNavBar`). Runtime/a11y verification pending for latest redesign. |
| `YugmLoadingSpinner` / `YugmLoadingSpinnerDefaults` | `YugmLoadingSpinner.kt` (`core/ui`) | App-wide loading spinner; renders the single approved Lottie animation (`res/raw/loading_spinner.json`). Replaces `CircularProgressIndicator` spinner usages; callers pass a baseline `size`/`modifier`, and the component applies the global `SizeScale` (1.25; baseline default 40dp). |
| `AssetArtwork` / `selectAssetArtworkUrl` | `AssetArtwork.kt` (`core/ui`) | Single asset-aware image entry point: chooses a named variant → `full` → direct URL, resolves relative URLs through `resolveMediaUrl()`, and renders the caller's fallback when no asset loads. Used by cosmetic, badge and gift art. |
| `BadgeArtwork` / `WornBadgeRow` | `BadgeArtwork.kt` (`core/ui`) | Shared earned-badge icon and centered horizontal worn-badge row. Uses `AssetArtwork` for managed badge art with an icon fallback. `WornBadgeRow` renders up to the server-sourced `capacity` (`BadgeGallery.FALLBACK_CAPACITY = 5` only for older APIs) and is used in the profile header below ID/level and above the description. |
| `AvatarGeneratorDialog` / generated avatar UI | `core/ui/avatar/AvatarGeneratorDialog.kt`, `GeneratedAvatar.kt`, `AvatarEngine.kt` | Shared offline Multiavatar customization dialog and SVG rendering helpers used by profile creation and Edit Profile (integration in progress). |
| `AutomaticSyncEffect` | `AutomaticSyncEffect.kt` | Shared sync-related UI effect; inspect before reuse |
| `ReferenceComponents` | `ReferenceComponents.kt` | Other shared components/utilities in this file (page header, chips, segmented tabs, ambient background, etc.) require source review when reused |

Other reusable visuals include `CosmeticArtwork`, `ReactionArtwork`, `ProfileLiveVoiceBanner`, `ParticleEffects`, `FloatingEmojiEffect`, and `AnimatedEqualizer`. This registry is an initial inventory; each entry's parameters, supported states, and use locations should be expanded as those components are touched. Prefer Material 3 primitives for common controls where no shared Yugm equivalent exists.
