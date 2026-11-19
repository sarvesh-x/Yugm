# Shared component registry

This is a source-location index, not a guarantee that every screen uses these components consistently. Shared Compose components currently live in `android-client/core/ui/src/main/java/com/yugm/app/core/ui/components/`.

| Component or family | Source | Purpose / notes |
|---|---|---|
| `BrandHeader`, `AuthShell` | `SharedComponents.kt` | Brand and auth layout |
| `SearchBar`, `CategoryChips`, `Chip`, `ChipWrap` | `SharedComponents.kt` | Discovery filters/search affordance |
| `RoomCarousel`, `RoomCard` | `SharedComponents.kt` | Room discovery presentation |
| `Avatar` | `Avatar.kt` | Shared avatar presentation |
| `AvatarLiveIndicator` | `AvatarLiveIndicator.kt` | Live state decoration |
| `GlassComponents` | `GlassComponents.kt` | Branded glass surfaces |
| `RoomShell` | `RoomShell.kt` | Room screen shell |
| `GiftPanel` | `GiftPanel.kt` | Gift interaction UI |
| `PkComponents` | `PkComponents.kt` | PK presentation |
| `ControlButton` | `ControlButton.kt` | Room/media control affordance |
| `ChallengeCard` | `ChallengeCard.kt` | Challenge presentation |
| `SlimLineFrame` | `SlimLineFrame.kt` | Decorative frame |
| `AutomaticSyncEffect` | `AutomaticSyncEffect.kt` | Shared sync-related UI effect; inspect before reuse |
| `ReferenceComponents` | `ReferenceComponents.kt` | Inventory contents require source review |

Other reusable visuals include `BadgeArtwork`, `CosmeticArtwork`, `ReactionArtwork`, `ProfileLiveVoiceBanner`, `ParticleEffects`, `FloatingEmojiEffect`, and `AnimatedEqualizer`. This registry is an initial inventory; each entry's parameters, supported states, and use locations should be expanded as those components are touched. Prefer Material 3 primitives for common controls where no shared Yugm equivalent exists.
