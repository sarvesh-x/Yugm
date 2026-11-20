# Avatar API Contract (implemented/current)

This document reflects the current source-level contract for generated/uploaded avatars. Verify against live behavior and socket/realtime payloads as part of parity audit.

## Profile/user payload fields
Avatar-bearing user/profile objects may include:
- `avatar: string | null` — public URL for uploaded avatars (or legacy value where present); for generated avatars, client clears/stores according to existing flow (descriptor is authoritative when `avatarType=GENERATED`).
- `avatarType: "UPLOADED" | "GENERATED" | "DEFAULT" | null` (string; values as used by implementation)
- `avatarParts: { background, clothes, head, mouth, eyes, top } | null` — each integer 0–47

## Create/update profile
- Existing profile create/update endpoints accept generated avatar data through current request shapes (Android sends `avatarType="GENERATED"` and serialized parts in profile update/create payloads as implemented).
- Request validation: shared `profileSchema` (`@yugm/shared`) now accepts optional `avatarType` (`UPLOADED|GENERATED|DEFAULT`), optional/nullable `avatarParts` (`{background,clothes,head,mouth,eyes,top}` each 0–47), and optional/nullable `avatar`, so `PATCH /auth/profile` and `PATCH /users/me` (validated via `profileSchema.partial()`) pass descriptor fields through instead of stripping unknown keys.
- Backend validation/normalization in `services/profileUpdate.ts`:
  - generated avatars require valid source/type semantics as implemented and six in-range integer parts
  - mutually consistent source handling (generated vs uploaded/default) is enforced/normalized by service logic
  - persists atomically with profile update (subject to existing revision/conflict/idempotency behavior of the profile update path; avatar-specific audit pending)

## Avatar upload
- `POST /api/upload/avatar` (multipart, auth required): uploads image to storage (R2/S3 when configured), returns `{ url, storage }`.
- On success, backend sets `avatarType="UPLOADED"` and unsets `avatarParts`; may clear conflicting generated state.

## Read exposure
- `publicUser(...)` builders (e.g. `routes/auth.ts`, `routes/users.ts`) include `avatarType` and `avatarParts`.
- Many routes/services include `avatarType avatarParts` in user selects/populates for hosts, members, chat/story/event/feed/social entities, admin views, etc. (broad but not yet fully audited for parity across every endpoint/socket event).

## Realtime/socket events
- Profile/user update events should propagate avatar descriptor changes to interested clients via existing mechanisms. **Parity audit pending:** not all socket payloads have been verified to include/apply `avatarType`/`avatarParts` with revision/conflict/idempotency guarantees required by the plan.

## Backward compatibility
- Legacy clients/data may only understand `avatar` URL or default placeholders.
- Unknown/missing descriptor fields must fail safely in rendering (fallback to uploaded/default/initials).
- Older clients’ partial updates must not unintentionally erase generated avatar fields (requires verification).

## Known gaps
- End-to-end endpoint/socket inventory and parity verification.
- Canonical request/response schema documentation aligned with OpenAPI/contracts where applicable.
- Revision/concurrency/idempotency behavior audit for avatar-specific updates.
- Migration/compat behavior for pre-existing users and mixed client versions.
