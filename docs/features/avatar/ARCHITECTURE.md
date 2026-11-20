# Avatar Generation Architecture

## Overview
Generated avatars use the Multiavatar engine integrated into `android-client/core/ui` under `com.yugm.app.core.ui.avatar`. Generation/customization runs on-device/offline. The app persists a compact descriptor (`provider`, `version`, 6 part IDs) instead of uploading generated SVG/bitmap assets.

## Android components
- **Engine/adapter:** `MultiAvatar.kt` + `ValueObjectCreator.kt` (adapted upstream engine), `AvatarEngine.kt`, `MultiavatarEngine.kt`
  - Parts: `background`, `clothes`, `head`, `mouth`, `eyes`, `top` (0–47 each)
  - Deterministic render from descriptor; randomize-all and per-part shuffle
- **Models:** `AvatarModels.kt` (`AvatarParts`, `AvatarCategory`, `AvatarDescriptor`, `AvatarSource`)
- **Cache:** `AvatarCache.kt` (bounded in-memory SVG cache, key `multiavatar:v{version}:{bg|clothes|head|mouth|eyes|top}`)
- **Rendering:** `GeneratedAvatar.kt` renders SVG bytes through Coil; shared `core/ui/components/Avatar.kt` resolves `avatarType=GENERATED` + `avatarParts` to generated rendering with fallback to uploaded/default image/initials.
- **Dialog/UI:** `AvatarGeneratorDialog.kt` shared by profile creation and Edit Profile.
- **Entry points:** `feature/auth` profile creation (`CreateProfileScreen`, `AuthNavGraph`) and `feature/profile` Edit Profile (`ProfileDetailScreen`) submit/retain generated drafts.

## Data flow
1. User chooses **Generate avatar** in profile creation or Edit Profile.
2. `AvatarGeneratorDialog` creates/edits a draft descriptor locally (no network).
3. On confirm, parent draft state is updated; **Continue/Save** persists through existing profile APIs.
4. Generated save sends `avatarType="GENERATED"` and `avatarParts` (and clears uploaded avatar URL semantics as applicable). Uploaded photo flow sets `UPLOADED` and clears `avatarParts`.
5. API/session responses carry `avatar`, `avatarType`, `avatarParts`; session is persisted client-side (`SessionManager`, `MainViewModel`, `NavGraph` login handoff).
6. UI consumers render via shared `Avatar(...)` with descriptor fields when available.

## Backend
- `User` schema stores `avatarType` and `avatarParts` (`background/clothes/head/mouth/eyes/top`).
- `services/profileUpdate.ts` validates/normalizes generated descriptors and persists atomically with profile update semantics.
- `POST /upload/avatar` stores uploaded image and marks avatar as `UPLOADED`, unsetting `avatarParts`.
- Many user/avatar selects/populates and `publicUser(...)` builders include `avatarType`/`avatarParts` to expose descriptors.
- Generated avatars do not require R2 object storage.

## Integration status
Core engine, dialog, profile create/edit flows, session plumbing, and partial app-wide model/parser/UI propagation are implemented in source. Full consumer/API/socket parity, migrations/backward-compat audit, visual/runtime verification, and complete docs/attribution records remain in progress (see `docs/CURRENT_TASK.md` and handoffs).
