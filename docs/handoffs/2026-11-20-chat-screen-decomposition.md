# Handoff — ChatScreen decomposition (2026-11-20)

## What changed
Frontend-only refactor of `:feature:chat` to reduce compile-time cost of the monolithic `ChatScreen` composable. No architecture, wiring, state ownership, or behavior changes.

New files:
- `feature/chat/.../screens/ChatScreenMessageItem.kt` — `ChatTimelineMessageItem` (per-message swipe-to-reply + MessageBubble).
- `feature/chat/.../screens/ChatScreenHeader.kt` — `ChatScreenHeader` (header + selection-mode bar).
- `feature/chat/.../screens/ChatScreenComposer.kt` — `ChatScreenComposer` (emoji quick bar + composer).

`ChatScreen.kt` reduced from ~1388 to ~1091 lines. State remains owned by `ChatScreen`; subcomposables receive values + callbacks.

## Verification
- `.\gradlew.bat :feature:chat:compileDebugKotlin` — BUILD SUCCESSFUL.
- `.\gradlew.bat :feature:chat:testDebugUnitTest` — 3/3.
- `.\gradlew.bat :app:compileDebugKotlin` — BUILD SUCCESSFUL.
- `git diff --check` — clean (pre-existing LF/CRLF note on CURRENT_TASK.md).

## Not verified
Release compile timing comparison, UI behavior parity beyond compile/tests (manual chat flow still advisable).