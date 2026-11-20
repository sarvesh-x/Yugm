# Avatar generation and customization

## Status
**In progress (uncommitted).** Native offline Multiavatar generation/customization is integrated into Android profile creation/Edit Profile with compact descriptor persistence and partial app-wide rendering/data propagation. Backend schema/validation/routes expose descriptor fields in many paths, but full end-to-end contract parity, licensing provenance, docs completeness, and required verification remain pending.

## Implemented (source)
- **Engine/UI (`core/ui`):** adapted Multiavatar engine and models under `com.yugm.app.core.ui.avatar` (`MultiAvatar`, `MultiavatarEngine`, `AvatarDescriptor/Parts/Category`, `AvatarCache`, `GeneratedAvatar`, `AvatarGeneratorDialog`).
- **Shared rendering:** `core/ui/components/Avatar.kt` renders generated descriptors when `avatarType`/`avatarParts` provided, with fallback to uploaded/default avatars.
- **Profile flows:** “Generate avatar” alongside “Choose photo” in profile creation (`feature/auth`) and Edit Profile (`feature/profile`); dialog confirm updates draft, parent save/continue persists via existing APIs.
- **Session/client plumbing:** `YugmUser`/`Host`/`AuthProfileUpdate` and many non-Host models include descriptor fields; `SessionManager`, `MainViewModel`, `ProfileParser`, and parsers/APIs updated across multiple surfaces (partial but expanded).
- **Backend:** `User` schema stores `avatarType`/`avatarParts`; `profileUpdate` validates/normalizes; `POST /upload/avatar` sets `UPLOADED` and clears parts; many selects/populates and `publicUser` responses include descriptors.
- **Attribution:** “Avatars by Multiavatar” credit added to Settings/About UI (source).

## Gaps / blockers
- **Upstream provenance & licensing:** pinned `mew22/Multiavatar` commit/version not recorded in repo; required license/copyright notices not verified/preserved. In-code `core/ui/avatar/UPSTREAM_PROVENANCE.md` and `docs/features/avatar/LICENSING.md` document gaps factually but do not satisfy verification/notice requirements. See [LICENSING.md](LICENSING.md) and [MULTIAVATAR_INTEGRATION.md](MULTIAVATAR_INTEGRATION.md).
- **Coverage:** many API parsers/clients, UI consumers, and socket/realtime payloads still need descriptor propagation/parity audit.
- **Verification:** tests, lint, release build, runtime/device visual+SVG+a11y QA, performance/memory, APK/AAB size, migration/backward-compat not completed.
- **Diff hygiene:** working tree has unrelated whitespace-only tracked diffs from prior automated scripts; changes are uncommitted.

## Docs
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [MULTIAVATAR_INTEGRATION.md](MULTIAVATAR_INTEGRATION.md)
- [API_CONTRACT.md](API_CONTRACT.md)
- [DATA_MODELS.md](DATA_MODELS.md)
- [UI_GUIDELINES.md](UI_GUIDELINES.md)
- [LICENSING.md](LICENSING.md)
- [TESTING.md](TESTING.md)

## References
- Plan: `C:\Users\longl\OneDrive\Desktop\yugm-multiavatar-implementation-plan.md`
- Task/progress: `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`
- Latest handoff: `docs/handoffs/2026-11-20-multiavatar-continuation-18.md`
