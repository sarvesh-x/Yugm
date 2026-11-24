# Local Auth session adapters

Authentication is still the active journey. The API uses the existing MongoDB session path through the new persistence boundary. The D1 implementation is exercised with a disposable local binding. [Journey order](../migration/implementation-plan.md#journey-order)

- The shared token service produced the expected JWT claims and session envelope across both stores. Normal cases covered login, rotation, replay, single-device generation and scoped logout. Legacy cases covered the hydrated default for omitted generations, explicit null and generation zero. [Session fixture](../../backend-server/apps/api/src/migration/d1AuthSessionStore.test.ts)
- D1 commits account generation and session issuance in one batch. It also commits the refresh claim and successor together. Concurrent logins left only the highest generation active. Two refreshes that had both read the old session returned one success and one replay denial, then the replacement refresh was rejected because its family was revoked. Forced duplicate-hash failures rolled back generation advance and refresh claims. [D1 implementation](../../backend-server/apps/api/src/migration/d1AuthSessionStore.ts) · [Cloudflare batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- The draft D1 schema indexes refresh hash, account-scoped revocation and family-scoped revocation. Import retries update the same source ID. A different source row with a duplicate refresh hash surfaces a constraint error and leaves the original row intact. [Import writer](../../backend-server/apps/api/src/migration/d1Target.ts)

## Verification

From `backend-server`.

```powershell
npm.cmd exec --workspace @yugm/api -- tsx --test src/migration/d1AuthSessionStore.test.ts src/routes/authJourney.characterization.test.ts src/routes/authAppCheck.characterization.test.ts src/migration/adapters.test.ts src/migration/mappings.test.ts src/migration/rehearsal.test.ts src/services/authSessionRules.test.ts src/services/media.routes.integration.test.ts
npm.cmd run typecheck --workspace @yugm/api --workspace @yugm/cloudflare-worker
npm.cmd run schema:d1 --workspace @yugm/api
```

The 48 focused tests and both workspace typechecks passed. The generated 146-table schema matched the draft with zero import failures. From the repository root, `node backend-server/scripts/production-inventory.cjs` refreshed route locations and `git -c core.safecrlf=false diff --check` passed.

## Remaining Auth work

The D1 tests call the real token service with a fixture-selected store. The existing Auth HTTP and protected media fixtures call the MongoDB path. Protected HTTP and socket access, Firebase identity and device-token persistence, and cross-instance access revocation still need candidate runtime verification. Plan expiry cleanup before a live D1 rollout because the MongoDB TTL index currently does that work. The full API suite, Android device behavior, staging and production were outside this run. No resources were provisioned or deployed. [Current task](../CURRENT_TASK.md)
