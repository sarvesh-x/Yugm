# Avatar Data Models

## Canonical descriptor (client, `core/ui/avatar`)
```kotlin
data class AvatarParts(
  val background: Int, // 0..47
  val clothes: Int,    // 0..47
  val head: Int,       // 0..47
  val mouth: Int,      // 0..47
  val eyes: Int,       // 0..47
  val top: Int         // 0..47
)

enum class AvatarCategory { TOP, HEAD, EYES, MOUTH, CLOTHES, BACKGROUND }

data class AvatarDescriptor(
  val provider: String = "MULTIAVATAR",
  val version: Int = 1,
  val parts: AvatarParts
)

sealed interface AvatarSource {
  data class Generated(val descriptor: AvatarDescriptor)
  data class Uploaded(val imageUrl: String)
  data object Default
}
```

## API/model payload shape (`core/model`)
- `AvatarPartsPayload(background, clothes, head, mouth, eyes, top)` used in network/domain models.
- Descriptor-bearing fields added across models, e.g.:
  - Session/user: `YugmUser.avatar`, `avatarType`, `avatarParts`; `Host.avatarType`, `avatarParts`
  - Social/content: `ChatMessage.authorAvatar*`, `RoomActivityItem.avatar*`, `RoomRecording.hostAvatar*`, `YugmEvent.hostAvatar*`, `StoryUser/StoryItem/StoryCommentItem` user avatar fields, `FeedUser.avatar*`
  - PK: `PkSide`/`PkOpponent.hostAvatar*`, `PkTeamMember`/`PkLeaderboardEntry.avatar*`
  - Other: `WaveSender`, `DailyQuestionAnswer`, `VoicePoll` user avatar fields, `VibeTargetUser`, `BadgeGallery`, `SubscriptionCreator`, `ReferralUser`, `FriendUser`, `LeaderboardUser`, clan invitation invitee avatar fields, etc. (coverage expanded but not exhaustive)

## Backend persistence (`apps/api/src/models/User.ts`)
- `avatar: string | undefined` (uploaded URL/legacy as applicable)
- `avatarType: string | undefined` (e.g. `UPLOADED`, `GENERATED`, `DEFAULT`)
- `avatarParts: { background, clothes, head, mouth, eyes, top } | undefined`

## Validation rules (intended/implemented)
- Generated descriptors must include exactly six integer parts in range 0–47.
- Provider/version must be supported by implementation (`MULTIAVATAR`, version `1` currently).
- Conflicting source states should not be persisted (e.g. generated parts cleared on successful upload).
- Unknown/invalid descriptors must not crash clients; render fallback.

## Versioning
- `version` identifies renderer/artwork semantics. Updates that change visual output for same part IDs must be handled via versioning/migration strategy (not yet fully documented/verified).
- Cache key includes version and ordered parts: `multiavatar:v{version}:{background}|{clothes}|{head}|{mouth}|{eyes}|{top}`.

## Compatibility notes
- Legacy avatar URL-only data remains supported.
- Full migration/backward-compat behavior and old-client partial-update safety require audit and testing.
