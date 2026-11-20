# Multiavatar integration — upstream provenance and licensing status

**Status:** Incomplete / action required (blocking for plan completion)

## What this directory contains
- Adapted/integrated Multiavatar avatar generation and customization code for Yugm Android (`core/ui`), including engine, models, rendering helpers, and dialog-related support used by profile avatar flows.
- Integration performed incrementally in uncommitted working-tree changes during YUGM-AVATAR-MULTI-009 (see `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, and `docs/handoffs/2026-11-20-multiavatar-continuation-*.md`).

## Known upstream references (from plan/repo docs)
- Upstream Kotlin port: https://github.com/mew22/Multiavatar
- Original Multiavatar generator/artwork: https://github.com/multiavatar/Multiavatar
- Original artwork license: https://www.multiavatar.com/license/
- Implementation plan: `C:\Users\longl\OneDrive\Desktop\yugm-multiavatar-implementation-plan.md`

## Not yet recorded/verified (must be completed)
1. **Exact audited upstream source** for the Kotlin port: pinned commit hash/tag/version, retrieval date, and source path(s) used.
2. **License of the Kotlin port** for that exact pinned source/commit.
3. **Original Multiavatar artwork license/terms** applicable to embedded/generated use in Yugm, including any required attribution/notice/usage restrictions.
4. **Required copyright and license notices** preserved in source/distribution as mandated by applicable licenses.
5. **Local modifications** relative to upstream, documented with rationale.
6. **Legal/compliance confirmation** that in-app/commercial use and integration approach are permitted (and not a prohibited repackaging/rebranding/competing avatar product).

## Current attribution in app (source)
- “Avatars by Multiavatar” string added to Settings/About UI in source (`feature/settings`), but runtime/shipped placement and legal sufficiency require verification.

## Required actions
- Obtain/verify the exact upstream commit/version and licenses before claiming compliance or completion.
- Add required `LICENSE`/`NOTICE` files and/or source headers as applicable.
- Update `docs/features/avatar/LICENSING.md` and this file with verified evidence (URLs, commit IDs, dates, notice text/file locations, and modification notes).
