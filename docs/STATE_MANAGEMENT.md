# State management map

## Android

Existing patterns include ViewModels/state holders, repository/API clients, Room cache, session storage, and separate account/room realtime clients. Start with the affected feature's ViewModel and API/repository, then inspect `core/data/`, `core/api/`, and DI bindings. Keep UI state single-owned and observable. Distinguish cached, optimistic, pending, and server-confirmed values. See [production architecture](production/architecture.md) and [current progress](production/current-progress.md) for specific chat/socket gaps and evidence.

## Backend

Persisted state is represented by Mongoose models, route/service operations, and optional transactions. Socket presence/typing are transient; do not treat them as durable domain state. Identify the one authoritative command path before duplicating business logic. For post-commit effects, assess whether retry/recovery is required.

## Invariants

An optimistic client update is not evidence of server commit. Account caches and delayed requests must remain bound to their originating identity. Reconnect behavior must define snapshot, cursor/revision, duplicate handling, and deletions for durable state. Transaction boundaries must include all coupled persisted mutations.
