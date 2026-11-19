# Error handling

## Android

Represent request progress and failure in screen state. Keep empty results distinct from failed requests. Preserve coroutine cancellation, show permission/session failures clearly, and only display success after the authoritative operation succeeds. Keep retry behavior safe for command idempotency; a timeout may mean the server committed even if the client missed the response.

Auth provider credential acquisition, Firebase sign-in, and backend exchange share one ViewModel-owned exclusive operation. Always settle it in one `finally`/cancel path. Preserve the Firebase identity after an ambiguous backend exchange so the same provider can retry safely. Treat App Check 401s separately from account-session 401s; session refresh/revocation clears local state and explains when another device signed in. See [auth-flow audit](features/auth-flow-audit.md).

## Backend

Use existing `HttpError`, `ErrorCode`, `asyncHandler`, validation middleware, and response helpers in `src/utils/http.ts` and route middleware. Validate before mutation. Do not swallow an error if it changes whether the requested command committed. Separate a committed command from recoverable post-commit fanout; use durable recovery where required.

Inspect route-specific response behavior before changing clients because legacy response envelopes differ. Log enough context to diagnose without recording secrets, tokens, or unnecessary private content.
