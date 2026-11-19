# Coding standards

Use repository conventions and current implementations as the first reference. These standards set shared expectations without prescribing a rewrite.

## Android

- Keep Compose rendering declarative. Put asynchronous work and business decisions in ViewModels/state holders and repositories/services.
- Expose observable, screen-level UI state and explicit user actions; collect state with lifecycle awareness where supported by the existing screen setup.
- Use Hilt and existing module boundaries. Avoid feature-to-feature dependencies and duplicate sources of truth.
- Reuse `:core:ui` theme, components, motion preference, and accessibility semantics. Preserve deliberate feature identity.
- Handle cancellation and resource cleanup for sockets, media, and lifecycle-bound work.

## Backend

- Keep Express routing and HTTP validation at route boundaries; put reusable domain operations in services and persistence in Mongoose models/repositories as the existing code does.
- Apply authentication and resource authorization separately. Validate untrusted input with the established Zod/shared schemas.
- For state-changing operations, define the authoritative service, transaction boundary, idempotency scope, and post-commit side effects.
- Use shared contracts from `@yugm/shared` when both clients and server consume them. Keep `openapi.yaml` aligned with actual mounted routes.
- Keep configuration external, use structured project error helpers, and do not swallow failures that determine command success.

## All changes

- Read callers and tests before changing contracts. Preserve compatibility intentionally and document migrations.
- Keep diffs focused; do not reformat or rewrite unrelated files.
- Add or update tests when asked or when required by the scoped change. Never report unrun checks as passed.
- Update the narrowest relevant docs and progress/handoff notes.
