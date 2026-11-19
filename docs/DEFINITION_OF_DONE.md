# Definition of done

A scoped change is done when applicable items are true:

- Existing implementation and callers were inspected; scope and acceptance criteria are met.
- Authorization, business rules, persistence, compatibility, and lifecycle/resource cleanup are handled for affected paths.
- UI uses the shared design foundation and has relevant loading, empty, error, disabled, and accessibility states.
- API/OpenAPI/shared schemas/realtime contracts agree where changed.
- Appropriate checks were actually run and passed, or remaining verification is explicitly recorded.
- Relevant documentation and progress/handoff state are current.
- No unrelated user changes were overwritten; no success or verification claim exceeds the evidence.

Use separate language for implemented, compiled, tested, and verified working. A feature is not end-to-end verified from UI or endpoint existence alone.
