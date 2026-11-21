# 2026-11-22 - Compact empty Bonds card on the profile

## Scope and decisions

Optimize only the completely empty own-profile Bonds state. The card is a compact horizontal glass card (~76–84dp) with the **Bonds** title, an inline `0/3` counter beside the title, the subtitle "Add people you feel connected to.", and a small **+ Add bond** button on the right using the current theme's primary button colors. The large centered heart icon, redundant "Add your bonds" heading, separate counter pill, excessive vertical padding, centered empty layout, reserved empty slots, and decorative elements are removed.

When at least one active bond or pending request exists, the existing profile card layout with up to three server-sized slots is rendered unchanged. Invitation, acceptance, pending status, and bond management flows are preserved. No backend, API, persistence, or realtime changes were needed.

## Changes

- **`android-client/feature/profile/.../bonds/BondsScreen.kt`:** `OwnBondsSection` short-circuits the empty/error-free case to a new `BondsEmptyCard` and no longer composes `ProfileBondSlotCard` slots when empty. The populated branch keeps the header, count pill, Manage action, and slot row. New `BondsEmptyCard` renders a `GlassCard` with `cornerRadius = 18.dp`, `contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)`, and a vertically centered `Row(heightIn(min = 48.dp))` so it stays ~76dp tall and can grow with accessibility font scaling. Counter is inline text; the button uses the standard themed `Button` with a compact icon + "Add bond" label.
- **`android-client/feature/profile/src/main/res/values/bonds_strings.xml`:** repurposed `bonds_profile_empty` to the new subtitle and removed the now-unused `bonds_profile_hint`.
- **Docs:** `DESIGN_SYSTEM.md`, `CURRENT_TASK.md`, and `DEVELOPMENT_PROGRESS.md`.

## Verification

- Android Studio JBR, `.\gradlew.bat :feature:profile:compileDebugKotlin --console=plain --max-workers=2` — BUILD SUCCESSFUL. Only pre-existing `hiltViewModel` and `Icons.Filled.HelpOutline` deprecation warnings were reported.
- `git diff --check` — clean apart from pre-existing LF/CRLF notices.

## Not verified / next session

- No device/emulator visual QA of the empty card: exact 76–84dp height, spacing, light/dark/system themes, font scaling, narrow widths, TalkBack labels, and the **Add bond** tap target.
- Full lint/assemble and compose/preview rendering were not run.
- Changes are uncommitted. Do not commit/push/deploy without explicit authorization.
