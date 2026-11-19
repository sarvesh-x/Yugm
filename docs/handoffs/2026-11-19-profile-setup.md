# Handoff: profile setup contract and remaining integration work

**Date:** 2026-11-19
**Task:** YUGM-PROFILE-SETUP-001
**Status:** Source implementation and focused Android/API checks are complete. Live backend persistence, provider-to-profile navigation, and device UX verification remain open.

## Contract locked with the user

Completion requires trimmed name, lowercase username, age 18–80, gender `Male`/`Female`/`Non-Binary`, city, at least one language, at least one interest, bio, `lookingFor` (`Friendship`/`Dating`/`Relationship`/`Networking`), and accepted terms. Avatar/vibe line are optional. A preexisting `profileCompletedAt` remains authoritative for legacy completed users.

## Delivered

- Added a profile field/completion matrix to the auth audit.
- Expanded shared profile schema and server completion checks; centralized normalization and profile updates in `profileUpdate.ts`.
- `/users/me` and retained `/auth/profile` now call the same update service, including username conflicts, set-once terms/completion timestamps, idempotent profile XP, and response shape.
- Updated client setup preference choices, required selection validation, DTO fields, and blank optional-field omission.
- Added a confirmation-protected sign-out exit from profile setup that resets the auth back stack.
- Added route-scoped `ProfileSetupViewModel` ownership for avatar upload and profile submit. It reads the current session token at operation time, prevents duplicate uploads/submissions, enforces image MIME and 5 MB limits, exposes upload/submit progress, handles cancellation separately, and only reports success when the server response confirms `profileCompleted`.
- Kept form input in `rememberSaveable` for saved-state restoration. Interrupted avatar uploads are retryable by selecting the photo again. Added client-side required-gender validation and removed the obsolete auth graph token callback.
- Applied the shared Aurora background/glass error component to profile setup while preserving the existing shared controls.
- Fixed the uploaded-avatar completion blocker: `/upload/avatar` returns and persists a data URL, so step-four validation now accepts only supported, bounded base64 image data URLs or valid hosted HTTP(S) references. Added an avatar success state and explicit retry copy. The large URL is not saved in the activity Bundle or resent in the profile-completion PATCH because upload already commits it.
- Added per-user `PROFILE` invalidation after successful avatar upload. Other upload routes remain excluded; middleware unit coverage verifies both paths.

## Verification

- From `android-client/`: `:core:model:compileDebugKotlin :core:api:testDebugUnitTest :core:data:compileDebugKotlin :feature:auth:testDebugUnitTest :app:compileDebugKotlin --console=plain` passed (`BUILD SUCCESSFUL`); auth unit tests 13/13 and core API unit tests 26/26.
- From `backend-server/`: `npm --workspace @yugm/api test` passed 169/169, including the avatar upload realtime invalidation rule; `npm --workspace @yugm/api run typecheck` passed.
- `git diff --check`: passed.

## Remaining before closure

1. Add focused ViewModel/UI tests for loading, upload failure/retry, duplicate submits, and complete/incomplete server responses.
2. Review the multi-step screen on small devices and larger font scales; verify focus/IME, motion, insets, screen-reader semantics, and light/dark rendering. Source changes use shared theme components but no device visual inspection was run for this profile pass.
3. Add Mongo-backed route tests for first completion, incomplete response, username conflict/retry, terms timestamp, XP idempotency, alias parity, persistence, and avatar upload/retry.
4. Exercise live Firebase signup/session handoff, profile completion, avatar upload/invalidation, and root back-stack reset; verify persisted Mongo profile fields and avatar semantics. No live backend/Firebase/Mongo runtime was used in this pass.

Do not run migrations or test against production data. The completion rule is enforced for new completions; existing persisted completion timestamps remain accepted.
