# Security rules

- Treat client input, uploaded files/media URLs, socket packets, callbacks, and external responses as untrusted.
- Auth endpoints require Firebase App Check in enforced environments. Use a fresh limited-use token per protected request and consume it during verification; never cache a consumed verification result. A replay result is an authorization failure, not evidence that the account session was revoked.
- Authentication establishes identity; authorize the exact resource, operation, role, account state, and transaction separately.
- Keep balances, purchases, rewards, moderation decisions, memberships, and permissions server-authoritative. Validate before mutation.
- Bind idempotency to actor, command, resource, and canonical payload as appropriate. A replay with changed inputs must not silently reuse a result.
- Keep credentials and signing/payment/storage secrets outside source control and documentation. Do not print tokens or private keys in diagnostics.
- Keep private verification/biometric information behind the documented access and retention controls. See [privacy](privacy-policy.md), [biometric handling](biometric-data-handling.md), and [data deletion](data-deletion.md).
- Apply equivalent authorization/session policy to HTTP commands and protected realtime subscriptions/events. Clean up sockets/media/work on account change or lifecycle end.
- Treat payment/provider callbacks as untrusted until signature, ownership, amount, and state transition checks pass. Preserve terminal/refund states.
- Do not run seeds, migrations, destructive queries, production calls, or publish changes without explicit authorization and a known target.
- R2 credentials and bucket names are server-only. Presigned upload/download URLs are bearer grants: generate them server-side with short TTLs, return them only to the authorized actor in the creating/authorized response, never log them, and never persist them in the media registry or client state. Validate staged bytes on the server before changing any public reference; derive all keys/owners from authenticated identity. See [Centralized R2 media](features/r2-centralized-media.md).

Use [permissions](permissions.md), [admin system](admin-system.md), payout/trust docs, and the [source finding register](production/findings.md) for feature-specific rules and open questions.
