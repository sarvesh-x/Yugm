# Avatar Testing and Verification

## Verification run (source-level, recorded)
- Prior continuations: targeted Android module/app Kotlin compiles and backend `tsc` passed as recorded in `docs/CURRENT_TASK.md`.
- Continuation 3 (2026-11-20): `android-client` `:core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin` **BUILD SUCCESSFUL**, `:app:compileDebugKotlin` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`).
- Continuation 4 (2026-11-20): targeted compiles for modified modules/features **[to be filled by executor]**; backend `tsc` not rerun for Android-only changes unless noted.

## Not run / pending (required by plan)
- **Automated tests:** Android unit/instrumentation tests, backend unit/integration tests, API validation/concurrency tests, golden SVG/render determinism tests for pinned version.
- **Build quality:** lint, release build, ABI/variant-appropriate APK/AAB size measurement before/after.
- **Runtime/device QA:** emulator/device manual testing for profile creation, Edit Profile, save/continue, photo↔generated transitions, cancel/retry/error states, process recreation/rotation, offline behavior, multi-device sync.
- **Visual/accessibility:** light/dark, font scale, narrow screens, small avatar sizes across all consumers (chat/feed/rooms/PK/events/discover/matches/notifications/clans/etc.), SVG parity, frames/cosmetics/presence overlays, reduced motion, TalkBack/labels/focus/touch targets.
- **Backend/runtime parity:** live API behavior, socket/realtime profile/chat propagation, migration/backward compatibility with older clients/data, upload↔generated transitions under real storage/auth conditions.
- **Performance:** render/cache latency, memory in lists/crowded rooms, duplicate-work avoidance, thumbnail/grid behavior.

## Acceptance checklist (high level)
Track completion against `yugm-multiavatar-implementation-plan.md` Definition of Done and `docs/CURRENT_TASK.md` remaining work. Do not mark complete until full workflow and required verification are evidenced.
