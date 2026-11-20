# Multiavatar Integration

## Upstream
- Library: `mew22/Multiavatar` (Kotlin transcription of Multiavatar generator), as specified by implementation plan.
- **Pinned upstream commit/version:** **NOT RECORDED** in repository source/docs at time of this handoff. This is a gap and must be recorded (exact commit hash or verified published artifact version, source URL, and audit date) before declaring completion.
- **Integration method:** source integration of engine logic into `android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/` (adapted), not a verified published Gradle artifact and not a separate Gradle module. Upstream sample-app dependencies/build targets were not imported.

## Local adaptations
- Removed dependencies on upstream sample/runtime stack (KMP/Koin/Coil3-specific usage, kotlinx-datetime, kotlincrypto, etc.) and adapted to project conventions.
- Uses `System.currentTimeMillis()`/`java.security.MessageDigest` where needed by adapted engine code.
- Rendering integrated with existing Android image loading approach (Coil + SVG support added to project as needed) via `GeneratedAvatar`.
- Engine/API exposed through local adapter interfaces/models: `AvatarEngine`, `MultiavatarEngine`, `AvatarDescriptor`, `AvatarParts`, `AvatarCategory`, `AvatarCache`.

## Reproducibility / update notes
- Engine is vendored as project source; updates require manually re-auditing upstream changes, preserving/refreshing license notices, verifying part-ID/visual compatibility (versioning), and updating recorded commit/version.
- Do not use floating branches/dynamic versions for generator logic.
- If a verified compatible published artifact becomes preferred, migrate in one coherent change and remove duplicate source.

## Licensing/attribution status (action required)
- Plan requires checking both the Kotlin port source license and original Multiavatar artwork license, preserving notices, adding “Avatars by Multiavatar” in app credits/About, and avoiding rebranding as a standalone product.
- **Current repo state:** license headers/notices and upstream LICENSE/NOTICE files for the integrated engine/artwork were not found in `android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/` or `android-client` during this session’s inspection. **Pinned commit/version not recorded.** This must be resolved before release/completion.
- “Avatars by Multiavatar” credit should be present in app About/Credits UI (verify in current build).

## Known gaps
- Record exact upstream commit/version and integration provenance.
- Add/preserve required license and copyright notices/files.
- Verify visual parity and API signatures against pinned upstream.
- Complete test/build/size/QA evidence.
