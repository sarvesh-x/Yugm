# One hosted Worker and emulator realtime

The production API workflow replaces the legacy staging workflow. Backend changes on `master` and manual runs target `yugm-api-production`. The workflow uses the `cloudflare-production` GitHub environment to verify the two D1 Worker entrypoints, apply hosted `yugm` migrations and deploy the production Worker with its existing R2 bindings. The Pages admin workflow targets its production project independently. Wrangler deployed production version `f5c1b922-35c4-4603-8e65-d6f4607754a6` with the hostname placeholder still in place. Resume production readiness checks when `YUGM_PRODUCTION_ORIGIN` names the live Worker.

Android uses a native `/realtime` WebSocket on both build types. The Worker validates the bearer token, chooses the signed-in user's channel or verifies active membership of the requested live room, and forwards upgrades to a Durable Object. The Durable Object rechecks the session and room membership before delivering or replaying events. D1 direct messages and room chat publish after commit. Existing PK publishers use the same path. Direct and clan typing are ephemeral. Realtime coverage remains partial for other legacy events, and live voice and video transport is separate. [Cloudflare WebSocket lifecycle](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Checks

- `npm run test:d1-worker` passed both suites. The local fixture rejects anonymous upgrades and a private room the caller has not joined. It verifies the committed room-chat message on an authorized socket and verifies a typing event delivered to a second authenticated user socket.
- `npm run typecheck --workspace @yugm/cloudflare-worker` passed. The production bundle excludes MongoDB and Redis libraries. `npm test --workspace @yugm/shared` passed all 27 tests.
- `:core:api:testDebugUnitTest --tests com.yugm.app.core.api.RoomSocketClientTest` passed. From an Android emulator shell, the local Worker on port 4000 returned D1 readiness and rejected a credential-free realtime upgrade with HTTP 401. End-to-end sign-in and authenticated WebSockets from the installed Android app remain unverified.

## Remaining work

- Verify that GitHub uses the production workflow and can no longer recreate the legacy staging Worker before retiring the existing hosted staging service. The repository uses one deploy target.
- Configure the production hostname and credentials in Cloudflare and the deployment variables and token in GitHub. The production API has no public ingress yet.
- Legacy Node models, fixtures, and migration tooling still use MongoDB packages. The current Workers and deployment checks use D1 and R2. Retire the legacy Node dependency graph before removing MongoDB from the repository lockfile.
