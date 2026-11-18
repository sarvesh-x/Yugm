# Android Build Performance Audit — Yugm (`android-client`)

**Date:** 2026-11-18  
**Scope:** `android-client/` Gradle/Kotlin/Compose/Hilt/KSP/AGP/Lint build performance, with focus on reported `:feature:chat` hangs and resource exhaustion.  
**Environment (observed):** Windows, JDK launcher 26 / Temurin 25 runtime reported by `java -version`, Gradle daemon toolchain Java 21 (from `gradle/gradle-daemon-jvm.properties`), Android Studio project; target hardware reported by user: Ryzen 9 7900X (12C/24T), 16 GB RAM, no dGPU.

> This report documents repository-level findings, implemented changes, and validation performed in this session. Some runtime claims from the original issue (intermittent indefinite hang, 100% CPU freeze) were **not fully reproducible on demand** due to warm caches and the cost/risk of cold reruns on a 16 GB environment; where evidence is unavailable, items are marked **Unverified**.

---

## A. Root cause analysis

### A1. Confirmed project/toolchain state (discovered)
| Area | Actual value |
|---|---|
| Gradle | **9.6.0** (`gradle/wrapper/gradle-wrapper.properties`) |
| AGP | **9.5.1** (`gradle/libs.versions.toml`) |
| Kotlin | **2.2.10** |
| Compose | Kotlin Compose plugin **2.2.10** + Compose BOM **2026.02.01** |
| Hilt | **2.60.1** |
| KSP | **2.2.10-2.0.2** |
| Java/JVM target | **Java 11** source/target/`jvmTarget`; Gradle daemon toolchain **Java 21** |
| Compile/target/min SDK | `compileSdk = 37`, `targetSdk = 36`, `minSdk = 24` |
| Modules | 1 app + 6 core + 14 feature modules (`settings.gradle.kts`) |
| Build logic | No `buildSrc`/convention plugins found |

**Annotation processing:** No active `kapt` usage found in module build scripts. Hilt uses **KSP** in app/core/feature modules (`ksp(libs.hilt.compiler)`), Room compiler uses KSP in `:core:data`. `kotlin-kapt` exists only as an unused catalog alias; `gradle.properties` already notes KSP replaced KAPT. **The reported task `:feature:chat:kaptGenerateStubsReleaseKotlin` was not present in the current build configuration** (unverified historically; likely stale or from a prior state).

### A2. Primary bottlenecks (evidence-backed)

1. **Memory pressure / thrashing risk on 16 GB (high confidence, addressed)**  
   - Previous `gradle.properties`: Gradle daemon **4 GB + 2 GB metaspace**, Kotlin daemon **6 GB**, lint worker **6 GB** (out-of-process), `org.gradle.parallel=false`, `workers.max=2`.  
   - Concurrent Gradle + Kotlin + lint heaps (~16 GB+) alongside IDE/OS/emulator can exceed physical RAM, causing swapping, sustained CPU, and apparent hangs/freezes. This aligns with reported “100% CPU, Windows nearly unresponsive”.

2. **Extremely large Kotlin/Compose sources in hot paths (high confidence)**  
   - `feature/chat/src/.../screens/ChatScreen.kt`: **2705 lines** total; `ChatScreen` composable is ~**1747 lines** (L156–1902); `MessageBubble` ~472 lines.  
   - `feature/chat/.../ChatListScreen.kt`: 1171 lines; `ChatViewModel.kt`: 938 lines.  
   - Repo-wide large files also include `ActiveVoiceRoomScreen.kt` (2733), `ProfileDetailScreen.kt` (1562), etc.  
   - Large monolithic composables/functions increase Kotlin compilation, Compose compiler, and lint/UAST/K2 analysis cost and reduce incrementality/locality.

3. **Lint analysis cost on large Compose UI (medium-high confidence, partially evidenced)**  
   - `gradle.properties` already worked around prior lint OOM by setting `android.experimental.runLintInProcess=false` and `android.experimental.lint.heapSize=6G` (comment references large `feature:chat ChatScreen.kt`).  
   - **Observed (this session):** cached run `./gradlew.bat :feature:chat:lintAnalyzeDebug --console=plain` completed **BUILD SUCCESSFUL (UP-TO-DATE)** quickly.  
   - **Observed:** a forced rerun after clearing chat lint intermediates/reports (`--rerun-tasks`) remained active for >7 minutes and progressed through dependency preparation/compilation/lint tasks (including core module lint and chat compilation), with multiple JVMs active (Gradle daemon, Kotlin daemon, lint worker). The run was **terminated intentionally** to avoid exhausting 16 GB RAM; it was **not observed to hang indefinitely**, but demonstrated heavy resource use under cold/rerun conditions.  
   - **Conclusion:** intermittent “indefinite hang” is plausible under memory pressure, expensive UAST/K2/Compose analysis on very large files, or pathological detector/source interactions; a single definitive detector-level root cause was **not isolated** in-session.

4. **Build configuration tradeoffs**  
   - `org.gradle.parallel=false` and `workers.max=2` reduced peak concurrency but serialized work and increased wall-clock time.  
   - `:feature:chat` depends on `:feature:social` (cross-feature dependency), increasing coupling and potential invalidation/build graph work.

### A3. Not found / ruled out in current config
- No KAPT processors active (KSP used for Hilt/Room).  
- No custom lint modules or `lint.xml` files found.  
- No `buildSrc`/convention plugins.  
- App lint disables only Timber-related checks (`LogNotTimber`, `StringFormatInTimber`, etc.); no broad lint suppression.

---

## B. Build configuration changes

### B1. `android-client/gradle.properties` (memory/parallelism tuning for 16 GB)
**Goal:** prevent memory thrashing and improve responsiveness while retaining parallelism.

| Setting | Before | After | Rationale |
|---|---:|---:|---|
| `org.gradle.jvmargs` | `-Xmx4096m -XX:MaxMetaspaceSize=2048m ...` | `-Xmx4g -XX:MaxMetaspaceSize=1g ...` | Keep Gradle daemon bounded; reduce metaspace overhead |
| `org.gradle.parallel` | `false` | `true` | Allow parallel module execution (with worker cap) |
| `org.gradle.workers.max` | `2` | `3` | Modest concurrency for 12C/24T without overcommitting RAM |
| `kotlin.daemon.jvmargs` | `-Xmx6144m` | `-Xmx4g -XX:MaxMetaspaceSize=1g` | Reduce peak Kotlin heap; leave headroom for lint/IDE |
| `android.experimental.lint.heapSize` | `6G` | `4g` | Bound out-of-process lint worker on 16 GB systems |
| Comments | prior rationale | updated rationale | Document responsiveness-first tuning |

**Kept:** `org.gradle.caching=true`, `org.gradle.configuration-cache=true`, `kotlin.incremental=true`, `org.gradle.daemon.idletimeout=3600000`, `android.experimental.runLintInProcess=false`, `android.builtInKotlin=false`, `android.newDsl=false`, `org.gradle.tooling.parallel=true`.

**Compatibility note:** `android.experimental.runLintInProcess` and `android.experimental.lint.heapSize` remain experimental (Gradle warned during tasks); retained because they directly mitigate daemon-heap OOM for large Compose analysis in this AGP/Kotlin setup.

### B2. `android-client/feature/chat/build.gradle.kts`
Added module lint block:
```kotlin
lint {
    // Reduce cross-module dependency analysis cost for this module; app-level lint
    // catches shared issues. Keep builds from failing silently.
    checkDependencies = false
    abortOnError = true
}
```
**Rationale:** avoid unnecessary dependency lint aggregation in the heaviest chat module while preserving failure visibility.

---

## C. Source-level optimizations

### Implemented
- **None applied to Kotlin/Compose source logic in this session** to avoid behavior/regression risk during audit without full UI/runtime test coverage.

### Identified (high-value, recommended)
1. **Refactor `ChatScreen` composable (highest priority in `:feature:chat`)**  
   - File: `feature/chat/src/main/java/com/yugm/app/feature/chat/screens/ChatScreen.kt`  
   - Current: single `ChatScreen` function spans ~1747 lines with extensive state/effects/UI/dialogs/sheets.  
   - Recommendation: extract cohesive sections into smaller private/top-level `@Composable`s (and separate files in same package if clearer), e.g. top bar, message list/timeline, input/composer, attachment/voice controls, gift/emoji/reaction sheets, dialogs/overlays. Hoist state/callbacks explicitly; preserve behavior and APIs.
2. **Reduce `MessageBubble` complexity** (~472 lines) by extracting subcomponents (media/voice/reply/reaction/status variants).
3. **Review `ChatListScreen.kt` (1171) and `ChatViewModel.kt` (938)** for separable responsibilities/helpers where it improves readability and compiler/lint locality.
4. **Broader hotspots (non-chat, for future work):** `ActiveVoiceRoomScreen.kt` (2733), `ProfileDetailScreen.kt` (1562), `RoomViewModel.kt` (1308) show similar monolith patterns.

**Caution:** perform refactors incrementally with compile/lint/UI verification after each step; do not split files purely by line count.

---

## D. Annotation processing improvements

- **Current state:** Hilt and Room already use **KSP**; no KAPT processors configured in modules.  
- **Action taken:** none required (no KAPT-to-KSP migration needed).  
- **Validation:** `:feature:chat:compileDebugKotlin` succeeded with current KSP/Hilt configuration after property changes (see benchmarks).  
- **Follow-up:** if new processors are added, prefer KSP-compatible versions and verify Kotlin/KSP/Hilt compatibility before migration.

---

## E. Benchmark comparison

> **Methodology notes:** measurements taken on the available Windows environment in-session; not all runs are cold/warm comparable. Cache state, daemon state, and background load affect results. Tasks killed due to resource pressure are reported as **terminated** (not successful).

| Task / scenario | Command | Cache/state | Workers | Result / time | CPU/memory notes |
|---|---|---|---:|---|---|
| Chat lint (cached) | `.\gradlew.bat :feature:chat:lintAnalyzeDebug --console=plain` | Warm / mostly UP-TO-DATE | default (props) | **SUCCESS**, ~4s (207 tasks up-to-date) | Low incremental cost when cached |
| Chat lint (forced rerun, diagnostic attempt) | `.\gradlew.bat :feature:chat:lintAnalyzeDebug --rerun-tasks --max-workers=1 --console=plain` (chat lint caches cleared) | Effectively cold for rerun graph | 1 | **TERMINATED** after ~7+ min while progressing (compiled chat, ran core/social prep/lint tasks; chat lint analysis phase not reached before stop) | Multiple JVMs observed (Gradle ~4GB, Kotlin daemon ~6GB per prior args at start of run, lint worker 6GB) — high memory pressure risk on 16 GB; stopped to preserve responsiveness |
| Chat debug Kotlin compile (post-change) | `.\gradlew.bat :feature:chat:compileDebugKotlin --console=plain` | Warm (75 tasks UP-TO-DATE) | 3 (new props) | **SUCCESS**, 19s, configuration cache stored | Configuration cache invalidation occurred due to build/property changes; execution cheap due to incrementality |
| Full debug build | `:app:assembleDebug` | — | — | **Not measured in-session** | Recommended via `scripts/build-fast.ps1` |
| Incremental debug / no-change build | targeted module/app | — | — | **Not measured (beyond UP-TO-DATE cases)** | Use repeated runs on same commit for comparable data |
| Release build | `:app:assembleRelease` / `:feature:chat:compileReleaseKotlin` | — | — | **Not measured in-session** | Release signing/env requirements apply (`YUGM_UPLOAD_*`, HTTPS URLs); see app build logic |
| `kaptGenerateStubsReleaseKotlin` | N/A | — | — | **N/A (task not configured; project uses KSP)** | — |

**Unverified:** peak CPU %, RSS/commit charge per process over time (not continuously sampled), and reproducible indefinite hang duration (not observed to completion/failure in forced rerun).

---

## F. Developer workflow

### New scripts (`android-client/scripts/`)
- **`build-fast.ps1`** — fast debug APK: `:app:assembleDebug` (optional `-Clean`). Skips lint/tests for iteration.
- **`build-chat.ps1`** — chat-focused builds: `-Variant debug|release` compiles chat Kotlin; `-Lint` runs chat lint (`lintAnalyzeDebug` / `lintRelease`).
- **`verify-android.ps1`** — verification flow: `:app:testDebugUnitTest`, chat debug lint (unless `-SkipLint`), `:app:assembleDebug`, and `:app:assembleRelease` unless `-SkipRelease` (release requires signing/env config).
- **`diagnose-gradle.ps1`** — bounded diagnostic run for a task (default `:feature:chat:lintAnalyzeDebug`) with `--info`, log capture to `android-client/build/diagnostics/`, and Java process snapshot on timeout; suggests `jcmd` thread dumps and safe stop.

### Recommended day-to-day commands (from `android-client/`)
```powershell
# Fast iteration (no lint/tests)
.\scripts\build-fast.ps1

# Chat-only compile
.\gradlew.bat :feature:chat:compileDebugKotlin --console=plain
# or
.\scripts\build-chat.ps1 -Variant debug

# Targeted chat lint (bounded diagnostics if needed)
.\scripts\build-chat.ps1 -Variant debug -Lint
# or diagnose hangs with logs
.\scripts\diagnose-gradle.ps1 -Task ":feature:chat:lintAnalyzeDebug" -InfoSeconds 300

# Full verification (when needed)
.\scripts\verify-android.ps1
```

### Guidance
- Prefer **incremental** builds; avoid routine `clean`.
- If lint appears stuck, use `diagnose-gradle.ps1` and capture **multiple thread dumps** (`jcmd <pid> Thread.print -l`) to compare progress/hot detectors before killing processes.
- Keep **lint and release checks enabled** for CI/release validation; use fast scripts only for local iteration.

---

## G. Remaining issues and specific next actions

1. **Isolate intermittent lint hang (if reproduced):**  
   - Run `.\scripts\diagnose-gradle.ps1 -Task ":feature:chat:lintAnalyzeDebug" -InfoSeconds 300` on a cold/affected state; collect 2–3 thread dumps 30–60s apart from the lint worker/Gradle JVM; identify hot stacks/detectors.  
   - If a specific detector is implicated, apply a **narrowly scoped** suppression/workaround (module-level, documented) or fix the triggering source; avoid disabling lint globally.
2. **Refactor `ChatScreen.kt` (highest structural ROI):** split the 1747-line `ChatScreen` and 472-line `MessageBubble` into smaller composables/files with careful state/callback hoisting; validate UI/behavior and re-measure lint/compile times.
3. **Benchmark matrix:** record clean/incremental/no-change timings for `:feature:chat:compileDebugKotlin`, `:feature:chat:lintAnalyzeDebug`, `:app:assembleDebug`, and release compile/assemble under controlled warm/cold cache conditions with `--scan` or Gradle build scans if available.
4. **Memory tuning follow-up:** if 4 GB Kotlin/lint heaps cause OOM on cold release/lint, increase selectively (e.g. lint heap to 5g) while monitoring total system commit; if freezes persist, reduce `org.gradle.workers.max` to 2.
5. **Dependency hygiene:** evaluate replacing `:feature:chat -> :feature:social` coupling with shared abstractions in `core/*` if feasible (separate change, verify downstreams). Prefer `implementation` over `api` where safe (audit not exhaustive).
6. **`kaptGenerateStubsReleaseKotlin`:** if encountered again, capture the exact task graph/module and processor list; current repo shows **KSP-only** processing.
7. **Tooling upgrades:** AGP 9.5.1 / Kotlin 2.2.10 / Gradle 9.6.0 are recent; upgrade only if a specific lint/compiler issue is confirmed fixed upstream and compatibility is validated.

---

## H. Changes made (summary)
- Tuned `android-client/gradle.properties` for 16 GB responsiveness (heap caps, `parallel=true`, `workers.max=3`, reduced lint/Kotlin heaps).
- Added chat module lint configuration in `android-client/feature/chat/build.gradle.kts` (`checkDependencies=false`, `abortOnError=true`).
- Added developer scripts: `android-client/scripts/build-fast.ps1`, `build-chat.ps1`, `verify-android.ps1`, `diagnose-gradle.ps1`.
- Created this report: `docs/android-build-performance-audit.md`.

## I. Validation performed
- `:feature:chat:compileDebugKotlin` — **BUILD SUCCESSFUL** (post-change, warm/up-to-date execution).  
- `:feature:chat:lintAnalyzeDebug` (cached) — **BUILD SUCCESSFUL / UP-TO-DATE** observed.  
- Forced lint rerun diagnostic started and progressed but was **terminated** to avoid memory exhaustion; no indefinite hang conclusively reproduced in this controlled attempt.  
- Release build, full lint suite, and device/UI behavior tests: **not fully executed** in-session (environment/time/signing constraints). Release path and signing guards remain unchanged.

## J. Safety notes
- No application IDs, signing configs, Firebase config, server URLs, or release validation logic were modified.  
- Lint was **not** globally disabled; targeted module lint tuning only.  
- Experimental Gradle/AGP properties retained only where already in use for large-screen lint stability; reassess if upgrading AGP.  
- All changes are local, reversible, and documented above.
