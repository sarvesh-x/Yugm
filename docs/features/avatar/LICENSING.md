# Avatar Licensing and Attribution

## Status: **INCOMPLETE / ACTION REQUIRED**

The Multiavatar generation/customization feature depends on upstream Multiavatar engine and artwork licensing. Completion requires verified compliance and preserved notices.

## Required checks (per plan)
1. **Kotlin port license:** verify license of `mew22/Multiavatar` for the exact pinned source/commit used.
2. **Original artwork license:** verify https://www.multiavatar.com/license/ terms for the original Multiavatar artwork/assets as applicable to embedded/generated use in Yugm.
3. **Compatibility:** confirm commercial/in-app use is permitted under applicable terms and does not violate restrictions on repackaging/rebranding or creating a competing avatar product.
4. **Notices:** preserve all required copyright and license notices in source/distribution.
5. **Attribution:** include **“Avatars by Multiavatar”** in Yugm’s About/Credits section.

## Current repository findings (2026-11-20 session)
- Engine source integrated under `android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/` (adapted). No LICENSE/NOTICE files for this integration were found during inspection; **pinned upstream commit/version not recorded**.
- In-code provenance/status notes added: `android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/UPSTREAM_PROVENANCE.md` and comments in key adapted files (`MultiAvatar.kt`, `MultiavatarEngine.kt`, `ValueObjectCreator.kt`). These document gaps factually and do not claim compliance.
- “Avatars by Multiavatar” attribution text added to Settings/About UI in source during continuation (verify in runtime/build as part of QA).

## Required before completion/release
- Record exact upstream dependency version or source commit, repository URL, and audit date.
- Add required LICENSE/NOTICE files and/or source headers as mandated.
- Obtain/confirm legal/licensing approval if any ambiguity exists.
- Ensure attribution is visible in shipped app credits/about.
- Document any local modifications to upstream code.
