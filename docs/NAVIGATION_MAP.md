# Navigation map

## Android navigation sources

- App graph: `android-client/app/src/main/java/com/yugm/app/navigation/NavGraph.kt`.
- Shared route definitions/helpers: `android-client/core/navigation/src/main/java/com/yugm/app/core/navigation/`.
- Feature graphs: each module's `feature/<name>/.../navigation/` package.
- Top-level tab UI: `android-client/app/src/main/java/com/yugm/app/ui/screens/MainTabsScreen.kt`.
- App entry/session wiring: `android-client/app/src/main/java/com/yugm/app/MainActivity.kt`.

This source map is not a verified destination graph. When changing navigation, trace route definitions, graph registration, callers, deep links, auth gates, back behavior, and lifecycle-owned subscriptions. Confirm every destination exists and returns to the expected entry point. Update this document with a diagram only after a route inventory is reviewed end to end.
