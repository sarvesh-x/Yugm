# Local Auth access and revocation

The existing API and Socket.IO server now share access-token verification and session-generation rules. Their default runtime still reads MongoDB. The local D1 authorization reader queries the account and its active, owned session together through the direct binding, which uses the primary database. [D1 authorization reader](../../backend-server/apps/api/src/migration/d1AccessSession.ts) · [Cloudflare read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)

- The actual MongoDB `/api/auth/me` route and Socket.IO server accepted a current session and identified the same user. The Firebase sign-in, refresh, logout and App Check HTTP fixtures also passed. HTTP retains its existing MongoDB cache, and Socket.IO retains its existing handshake behavior in the default runtime. The HTTP cache key now includes both the account and session and distinguishes an omitted generation from zero.
- Two independent loopback server instances in the same Node process used separate guard and store instances over one disposable local D1 binding. The fixture verified required and optional access and rejected a session linked to a different account. It checked expiry and immediate changes to blocked and suspended accounts. The D1 reader preserves how MongoDB's hydrated HTTP read and lean socket read handle a missing legacy generation.
- After one fixture server committed logout, the other rejected HTTP access and socket reconnect. Its already connected client was disconnected when it sent the next packet, before the handler ran. An independent account retained access. Candidate packet rechecks run on inbound events. Idle sockets receiving only outbound events and cross-instance disconnect fan-out still need runtime coverage. [Transport fixture](../../backend-server/apps/api/src/migration/d1AuthSessionStore.test.ts)

## Verification

From `backend-server`.

```powershell
npm.cmd exec --workspace @yugm/api -- tsx --test src/migration/d1AuthSessionStore.test.ts src/routes/authJourney.characterization.test.ts src/routes/authAppCheck.characterization.test.ts src/routes/directMessages.characterization.test.ts src/services/media.routes.integration.test.ts
npm.cmd run typecheck --workspace @yugm/api --workspace @yugm/cloudflare-worker
npm.cmd ls socket.io-client --workspace @yugm/api
```

The 33 focused tests and both typechecks passed. npm resolved the existing Socket.IO client version for the new API test dependency. From the repository root, `node backend-server/scripts/production-inventory.cjs` refreshed socket source locations and `git -c core.safecrlf=false diff --check` passed.

## Remaining Auth work

The D1 fixture passed guard checks on local Express endpoints with a minimal user ID response. The full self-profile payload, Firebase identity linkage and FCM device-token cleanup still use MongoDB in the API. Verify them together through the candidate Auth journey before Navigation. Full-suite, separate Worker isolate, live Firebase, Android device and deployed transport checks were outside this run. No resources were provisioned or deployed. [Current task](../CURRENT_TASK.md)
