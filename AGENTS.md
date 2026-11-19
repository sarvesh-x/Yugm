# Yugm agent guide

Start every session with this file, then read [docs/INDEX.md](docs/INDEX.md) and [docs/CURRENT_TASK.md](docs/CURRENT_TASK.md). Read only the architecture, feature, contract, and design references relevant to the task. Check `git status` before editing and preserve unrelated work.

## Required workflow

1. Confirm the task scope and acceptance criteria from the user and `docs/CURRENT_TASK.md`.
2. Inspect the actual implementation and its callers before proposing or changing architecture.
3. Trace user actions across UI, state holder, API/realtime, persistence, and receiving clients when relevant.
4. Make the smallest coherent change. Preserve established behavior unless the task explicitly changes it.
5. Run only the verification appropriate to the change and requested by the user. Report commands, results, and checks not run; never infer runtime success from source presence.
6. Update the relevant docs and `docs/DEVELOPMENT_PROGRESS.md`. Before handing off unfinished work, update `docs/CURRENT_TASK.md` and add a dated record under `docs/handoffs/`.

## Project constraints

- Android source is a modular Kotlin/Jetpack Compose app. Reuse the existing `:core:ui` theme and components; do not add a competing theme or navigation system.
- Backend source is a Node.js/TypeScript npm workspace with an Express API, MongoDB/Mongoose, shared contracts, Socket.IO, and a React admin app. Follow existing route, service, schema, and middleware boundaries.
- Keep balances, purchases, permissions, memberships, and other authoritative state on the server. Validate authorization at the resource and operation boundary; a client result is not proof of commit.
- Treat `docs/production/` as detailed, evidence-linked audit material. Its dated baselines are not automatically current; check `current-progress.md` and source before relying on a finding.
- Do not expose credentials, run migrations/seeds against unknown environments, or commit, push, deploy, or release without explicit authorization.
- Gradle Kotlin compilation and lint can be resource intensive. Follow `docs/android-build-performance-audit.md`; use bounded, conservative verification and do not start a full build before static inspection.

## Engineering rules

- Prefer existing contracts, repositories, services, and UI components. Avoid duplicate sources of truth and broad rewrites.
- Keep UI state observable and owned by the appropriate ViewModel/state holder. Keep network and business operations out of composables.
- Preserve loading, failure, empty, permission-denied, retry, and cancellation behavior where applicable. Do not show success before an authoritative result.
- For money and other valuable operations, review transactions, idempotency, authorization, replay, and failure recovery together.
- Do not mark work verified unless the relevant check was actually run and passed. Document uncertainty as uncertainty.
