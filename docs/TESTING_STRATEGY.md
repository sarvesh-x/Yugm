# Testing strategy

Use the closest existing test infrastructure and scope checks to the change. Do not run broad or expensive checks without need; the Android build audit documents resource constraints.

- **Android:** module unit tests and instrumentation/UI tests live under module `src/test` and `src/androidTest`. Cover ViewModel state transitions, cancellation, navigation/lifecycle, theme/accessibility, and socket/media cleanup when affected.
- **Backend:** API tests use Node's test runner through `tsx`; shared/admin workspaces have their own scripts. Cover schema/input behavior, auth and resource policy, transaction rollback, replay/idempotency, concurrent transitions, and failure injection as relevant.
- **Contracts:** check changed API paths against OpenAPI, shared schemas, Android callers, and the static endpoint inventory.
- **Realtime:** test authorization, duplicate/out-of-order delivery, disconnect/reconnect, and listener ownership for affected paths.
- **Financial/high-value state:** use an isolated Mongo replica set for transaction tests; do not infer transaction support from standalone Compose Mongo. Never use production credentials/data for tests.
- **Reporting:** state exactly what was run and passed, and list material checks not run. Source inspection is static evidence only. Do not run tests or builds unless the user asks for verification or the task requires it.
