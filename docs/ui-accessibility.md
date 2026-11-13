# Android UI accessibility conventions

Apply these conventions to the native Android client in `android-client/`.

- Use `core/ui/theme` and shared components. Keep app-wide colors and shapes in semantic theme tokens; don’t add another theme package.
- Give every icon-only action a plain-language `accessibilityLabel`, role, and action label. Use `selectable` with selected state for tabs and filters.
- Make controls at least 48dp in both dimensions. Give decorative images a null description; give meaningful avatars a person label and expose states such as “Speaking” as text semantics.
- Add `statusBarsPadding`, `navigationBarsPadding`, and `imePadding` at the content boundary that owns those insets. Prefer Material `Scaffold` content padding where a screen uses Scaffold.
- Read `LocalMotionEnabled` for decorative animation and show a static equivalent when Android’s animator scale is zero.
- Use `heightIn` or content-driven sizing around text. Check the screen at font scale 2.0 before keeping a fixed height.
- Put user-facing copy in the owning module’s string resources. Use plurals and formatted resources for counts and values.
- Add Compose semantics tests for critical controls. Before release, walk the core flows with TalkBack and Switch Access and check them with Accessibility Scanner.

## Current validation status

The native app, core UI, auth, room-mode modules compile, and `:app:lint` completes. The attempted dock semantics instrumentation test could not attach a Compose hierarchy on the available Wi-Fi-debugging device, so that test scaffold was removed rather than left failing. Gradle lint does not replace Accessibility Scanner, TalkBack, Switch Access, large-font, or RTL checks; validate those on a supported emulator/device before release.
