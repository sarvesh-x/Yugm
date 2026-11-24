# Emulator Auth startup recovery

Android reached the backend Google exchange and received a generic 503. On port 4000, `/health` returned 200 while `/ready` and `POST /api/auth/google` returned 503. The local error detail confirmed that the running Wrangler process lacked the new auth rate-limit bindings. A fresh Wrangler process used all three bindings. The original local D1 schema also lacked fields in `user_auth_profile` and `media_upload_sessions` and lacked the `media_counters` table.

The existing local database contained zero application rows. Its verified SQLite snapshot and original files are under the ignored `backend-server/apps/cloudflare-worker/auth-local/.wrangler/backups/auth-recovery-2026-11-24/` directory. The replacement schema was tested on a disposable database before being installed into the default local persistence directory. The Worker restarted with the current config and reads the existing local Firebase and JWT settings. Hosted D1 and R2 were outside this recovery.

Local requests now return `D1_CONFIG_REQUIRED` for missing startup configuration and `D1_SCHEMA_UNAVAILABLE` for an incompatible binding schema. Debug validates the schema before serving API traffic. Production retains the generic 503 response and validates its schema on readiness checks. [Local setup and recovery commands](2026-11-24-local-d1-auth-emulator.md)

## Verification

- The refreshed local `yugm` schema applied 227 statements through Wrangler. Both SQLite snapshots passed the integrity check.
- From the Android emulator, `GET http://10.0.2.2:4000/ready` returned 200 with `storage: "d1"`. An empty JSON POST to `/api/auth/google` returned 422 with `VALIDATION`, confirming that the Worker reached the exchange handler.
- Both Worker suites passed, including missing bindings, a stale schema, schema recovery, App Check enforcement in the production fixture, and a Google account exchange with a signed Firebase test token. API and Worker typechecks passed.

A Google sign-in with the user's real account remains to be verified from the Android app.
