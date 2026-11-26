# Production Cloudflare target and Android build routing

The owner selected D1 and R2 for production storage, Firebase for identity and push, and RealtimeKit for the RTC migration on a $0 budget. The Android build type selects the environment. Existing Compose screens, navigation and gameplay rules remain the reference for parity.

The production Worker has since been deployed and the hosted schema advanced through `0041`. The remaining settings and verification are recorded in the [current production handoff](2026-11-26-production-d1-r2.md).

The later hosted R2 slice enables the five existing Standard buckets and extends the D1 routes. [Current configuration and verification](2026-11-24-hosted-r2-d1-endpoint-audit.md)

## Implemented

- **Debug.** The Android API and event origins are fixed at emulator loopback on port 4000. The existing local Wrangler profile uses simulated D1, R2 and Images bindings. [Local debug commands](2026-11-24-local-d1-auth-emulator.md)
- **Release.** `YUGM_PRODUCTION_ORIGIN` supplies the Worker HTTPS origin. Gradle derives the API and socket addresses, and the tagged release workflow reads the same repository variable. The placeholder is a reserved `.invalid` domain. Packaging checks for a production origin and existing upload signing. [Android build configuration](../features/release-build-configuration.md)
- **Production Worker.** `wrangler.production.jsonc` points to the D1 runtime through its own entrypoint. The runtime matches the configured HTTPS origin, enforces Firebase App Check on Auth, includes native R2 bindings for managed media, and uses a separate durable signing secret for media capabilities. The current production bundle excludes the legacy Worker runtime, MongoDB, Mongoose and the LiveKit server SDK. [Current HTTP coverage and cutover status](2026-11-24-mongodb-runtime-cutover.md)
- **RealtimeKit preparation.** The server client implements meeting creation, participant credential issuance with an expiry, removal and meeting deactivation. It disables automatic recording, exports and transcription at creation. Tests mock the provider API. Room admission, role/preset synchronization, durable session cleanup and the Android media transport remain open. Existing LiveKit-based Android rendering and room audio code are still in use on the legacy backend.

## Production inputs

| Input | Placeholder or destination |
| --- | --- |
| Production origin | Replace `https://api.yugm.invalid` in the production Worker vars. Set the same origin in Android Gradle or CI, and attach the actual production host to this Worker when it is ready. |
| D1 | Hosted `yugm` has the versioned schema and reference catalogs. Production-shaped recovery and any legacy account or media import remain separate rollout work. [Database verification](2026-11-24-d1-schema-and-reference-seed.md) |
| R2 | The five production bindings point at the verified hosted Standard buckets. `YUGM_R2_ENABLED=false` pauses managed media. |
| Firebase | Set `FCM_PROJECT_ID` for the production Firebase project. Store `FCM_CLIENT_EMAIL` and `FCM_PRIVATE_KEY` in the Worker secret store. Register the Android signing certificate with Firebase App Check. |
| API and media signing | Supply a persistent Worker `JWT_SECRET` and a separate `MEDIA_GRANT_SECRET` of at least 32 characters before enabling managed media. |
| RealtimeKit | The app ID, account ID, API token and voice/video publisher/listener presets are later inputs. Keep the account API token on the server. |

The production configuration has no public route attached, and disables `workers.dev` and previews. `/ready` checks the bound schema for the implemented routes and reports whether managed media is enabled. Readiness is scoped to those routes.

## $0 production envelope

- D1 Free has a 500 MB maximum per database, 5 million rows read and 100,000 rows written per day across the account. Queries fail after the daily free limits. Workers Free has its own invocation and CPU limits, so the local fixture is insufficient to establish production headroom. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- R2 Standard includes 10 GB-month of storage, 1 million Class A operations and 10 million Class B operations per month. R2 can incur charges above those allowances. Images Free has its own transformation cap. The owner approved hosted R2 for pre-release use. [R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Images pricing](https://developers.cloudflare.com/images/pricing/)
- Cloudflare lists 10,000 included participant-minutes per month for each of RealtimeKit audio-only and audio/video. Usage beyond those amounts is billed. An expired participant token blocks new joins and reconnects. Existing participants remain connected until they leave or the provider removes them. A production $0 implementation needs admission accounting and a reliable stop for active participants before the included allocation runs out. [RealtimeKit pricing](https://developers.cloudflare.com/realtime/realtimekit/platform/pricing/) · [RealtimeKit token behavior](https://developers.cloudflare.com/realtime/realtimekit/faq/)

## Verification

- `npm.cmd run test:production-worker --workspace @yugm/cloudflare-worker` passed. It built the production config with Wrangler dry-run and exercised canonical host enforcement, placeholders and missing credentials, D1 readiness, App Check rejection, default media disablement, a required media secret, and R2 variant delivery through simulated bindings.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` passed the existing local Auth, media, cosmetics and clan fixture against the shared runtime.
- `npm.cmd exec --workspace @yugm/api -- tsx --test src/routes/authJourney.characterization.test.ts src/routes/authAppCheck.characterization.test.ts src/routes/profileJourney.characterization.test.ts src/services/realtimeKit.test.ts` passed 21 checks for Auth and Profile behavior and the mocked RealtimeKit API.
- `npm.cmd run typecheck --workspace @yugm/api` and `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` passed.
- `gradlew.bat :app:generateDebugBuildConfig :app:generateReleaseBuildConfig --max-workers=2` passed with the default placeholder and with a disposable production-origin override. `gradlew.bat :app:compileDebugKotlin --max-workers=2` also passed.
- `git diff --check` found no whitespace errors.

Production data transfer, full API coverage, live Firebase App Check, device RTC parity and billing enforcement remain open. This change did not deploy, provision services, sign a release or change production data. [Whole-app migration coverage](2026-11-24-local-d1-r2-app-expansion.md)
