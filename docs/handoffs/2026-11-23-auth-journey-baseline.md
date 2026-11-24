# Authentication journey baseline

Authentication is the first active journey. Navigation, profile, settings, chat and rooms follow in that order. Arcade work stays deferred. [Journey order](../migration/implementation-plan.md#journey-order)

The fixture starts the existing Express API on loopback with a disposable MongoDB instance. It selects the Worker-mode Firebase token verifier and serves only a test public key for that verifier. It sends signed Firebase email-identity fixtures through the normal API routes. This run executes in Node. [Auth fixture](../../backend-server/apps/api/src/routes/authJourney.characterization.test.ts)

- Unverified email and the wrong Firebase project audience are rejected without creating a user or session.
- Verified email links to the same Yugm account ID and preserves its wallet balance. A different Firebase identity on that email returns a conflict. A repeat sign-in revokes the earlier persisted session.
- Verified signup returns the current profile-setup signal and default balance and persists the Firebase UID, terms acceptance and session.
- Refresh rotates the stored hash in the same session family. Reusing the previous token revokes the replacement. The protected session check exercises a fresh access-cache lookup after revocation.
- Logout revokes persisted sessions and removes the caller's registered device. Supplying another user's device token leaves that registration intact.

## Verification

Run from `backend-server`.

```powershell
npm.cmd exec --workspace @yugm/api -- tsx --test src/routes/authJourney.characterization.test.ts src/services/authSessionRules.test.ts src/services/authProfileContract.test.ts
npm.cmd run typecheck --workspace @yugm/api
```

Ten tests passed, including nested cases and existing rule tests. API typecheck passed.

## Remaining

The next pass covered the separate Google, Facebook and phone exchanges, App Check, already-cached access after session revocation and Android startup destination tests. [Follow-up Auth evidence](2026-11-23-auth-providers-and-session-mapping.md)
