# Release APK/AAB configuration for R2-backed media

**Date:** 2026-11-22  
**Status:** Documented for owner setup. This is not proof that a release artifact was built against a production deployment. No credential, bucket, deploy, release or production data change was made while writing this guide.

## Golden rule

R2 credentials, bucket names, object keys and signed URLs are **server-only**. A release APK/AAB never contains them and never talks to R2 with credentials. The client only:

1. asks the API for an upload session (`POST /api/media/uploads`);
2. PUTs bytes to the short-lived presigned URL returned by the API;
3. asks the API to commit the upload (`POST /api/media/uploads/{sessionId}/complete`).

The API host must therefore be a deployment that has R2 configured. The Android build only needs the API and socket URLs, signing, versioning and Firebase/App Check setup.

## What the release client needs

| Requirement | Why |
|---|---|
| HTTPS API URL ending in `/api` | Release builds reject non-HTTPS URLs; App Check is mandatory for non-loopback hosts. |
| HTTPS socket URL | Release builds reject non-HTTPS URLs. |
| `YUGM_SERVER_MODE=deploy` | Release tasks require deploy mode. |
| Upload keystore and passwords | Release signing is required; debug signing is not accepted for Play. |
| Version code and name | Play requires a monotonically increasing code. Defaults are `1`/`1.0`. |
| Firebase project with Play Integrity registered for the **release** signing certificate | Release auth requests attach App Check tokens. An unregistered certificate makes sign-in fail before any avatar upload. |
| Public HTTPS domain for the public-media bucket | The app loads committed avatar variants directly from the R2 public URL. |

The mandatory **`YUGM_API_BASE_URL`** has a staging default in `android-client/app/build.gradle.kts`. If it is omitted, a release artifact silently points at the staging Worker, which currently uses `STORAGE_DRIVER=mongodb` and therefore does not write managed media to R2. Always set it explicitly for a release.

## Android configuration

`configValue()` reads each setting from, in order:

1. a Gradle property (`-PNAME=value` or `gradle.properties`);
2. an environment variable;
3. the ignored `android-client/local.properties`.

Use `android-client/local.properties` for a local release build. It is gitignored. Never commit it.

```properties
# android-client/local.properties (ignored; do not commit)
YUGM_SERVER_MODE=deploy
YUGM_API_BASE_URL=https://api.example.com/api
YUGM_SOCKET_BASE_URL=https://api.example.com
YUGM_VERSION_CODE=1
YUGM_VERSION_NAME=1.0.0

YUGM_UPLOAD_KEYSTORE_FILE=C:/secure/yugm-upload.jks
YUGM_UPLOAD_KEYSTORE_PASSWORD=replace-with-secret
YUGM_UPLOAD_KEY_ALIAS=replace-with-alias
YUGM_UPLOAD_KEY_PASSWORD=replace-with-secret
```

Replace every placeholder with the real value. Do not paste real secrets into documentation, chat, source files, CI logs or analytics.

### Keystore path

`YUGM_UPLOAD_KEYSTORE_FILE` is passed to Gradle's `file()` inside the `app` module. A relative path is resolved from `android-client/app`, **not** from the repository root or `android-client`. Prefer an absolute path, and confirm the file exists before building:

```powershell
$p = (Select-String -Path android-client/local.properties -Pattern '^YUGM_UPLOAD_KEYSTORE_FILE=').Line -replace '^[^=]+=',''
Test-Path $p
```

A missing keystore passes configuration but fails at signing. Verify the path before building; a path that works from the repository root may still fail because Gradle resolves it from the `app` module.

### Enforced checks

For any task whose name contains `Release` (for example `assembleRelease`, `bundleRelease`), `android-client/app/build.gradle.kts` requires:

- `YUGM_SERVER_MODE=deploy`;
- non-blank `YUGM_API_BASE_URL` and `YUGM_SOCKET_BASE_URL`;
- both URLs start with `https://`;
- all four upload-signing properties are present.

These are Gradle configuration checks. A successful configuration is still not proof that the keystore, certificate, server or buckets are valid.

### Build commands

```powershell
cd android-client

# Play upload artifact (AAB)
.\gradlew.bat :app:bundleRelease --console=plain --max-workers=2

# Direct-install artifact (APK)
.\gradlew.bat :app:assembleRelease --console=plain --max-workers=2
```

Outputs:

- `android-client/app/build/outputs/bundle/release/app-release.aab`
- `android-client/app/build/outputs/apk/release/app-release.apk`

Release builds are resource intensive. Follow [the Android build performance audit](../android-build-performance-audit.md); do not start a full build before static inspection and do not add lint to the release task graph.

## Server configuration for the release endpoint

The release client must point at a deployment where managed media is enabled.

### Node host

Set these in the deployment's secret/environment store, not in tracked source:

```env
STORAGE_DRIVER=s3
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ASSETS_BUCKET=...
R2_PUBLIC_MEDIA_BUCKET=...
R2_PRIVATE_MEDIA_BUCKET=...
R2_ORIGINALS_BUCKET=...
R2_STAGING_BUCKET=...
R2_ASSETS_PUBLIC_URL=https://...
R2_MEDIA_PUBLIC_URL=https://...
# optional, 60-3600 seconds
R2_SIGNED_URL_TTL_SECONDS=900
```

`R2_ACCOUNT_ID` derives the endpoint `https://<account-id>.r2.cloudflarestorage.com`, `region=auto`, and the credentials. Explicit `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` still win over their R2 equivalents. If any legacy `S3_*` values are present, verify they point at the same R2 account; otherwise managed media can be signed for one endpoint while using R2 bucket names from another.

The managed storage service also falls back to `S3_BUCKET` when a specific `R2_*_BUCKET` is missing. A partial configuration can therefore put public, private, original and staging objects into the legacy bucket. Run the preflight; do not rely on the fallback for a release deployment.

### Cloudflare Worker host

- Put `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Wrangler **secrets**, never in tracked `vars`.
- Set `STORAGE_DRIVER=s3` and the five bucket names as non-secret per-environment configuration.
- All three tracked Wrangler configs currently set `STORAGE_DRIVER=mongodb`. Switching an environment to `s3` is deploy-affecting and requires separate owner approval and existing secrets/buckets. Do not change tracked Wrangler config as part of an Android release build.

Example secret command (repeat for each secret and the correct config):

```powershell
npx wrangler secret put R2_ACCESS_KEY_ID --config apps/cloudflare-worker/wrangler.staging.jsonc
```

### Cloudflare-side prerequisites

- One bucket per logical class per environment.
- Public access and an HTTPS custom domain for the assets and public-media buckets.
- No public access for private-media, originals or staging.
- Staging lifecycle rule to expire incomplete uploads.
- Buckets must be reachable from the public internet because devices upload/download directly.

The agent must not create buckets, bind domains, change CORS, rotate credentials or deploy without explicit authorization.

## Verification

### Before building

Server:

```powershell
cd backend-server
npm.cmd run env:check --workspace apps/api
npm.cmd run typecheck --workspace apps/api
npm.cmd test --workspace apps/api
```

`env:check` prints key names and set/blank status only; it never prints values. A green preflight does not prove bucket permissions, public access or network reachability.

Android:

- Confirm `YUGM_API_BASE_URL` is the intended release host, not the staging default.
- Confirm the keystore file exists and the alias/passwords are correct.
- Confirm the Play Integrity registration includes the release certificate fingerprint.
- Build the AAB/APK with the commands above.
- Install the signed artifact on a physical device; do not validate release behavior only on an emulator.

### Expected network sequence

| Step | Request | Expected |
|---|---|---|
| 1 | `POST https://<api-host>/api/media/uploads` | `200` with `sessionId`, presigned `uploadUrl`, `requiredHeaders`, `expiresAt`, `maxBytes` |
| 2 | `PUT https://<account-id>.r2.cloudflarestorage.com/...` | `200`; URL host must be R2, not the API host |
| 3 | `POST https://<api-host>/api/media/uploads/<sessionId>/complete` | `200` with the committed `avatarUrl` |
| 4 | `GET https://<api-host>/api/me` | New avatar URL resolves to the public-media domain |

If the client calls `POST /api/upload/avatar`, it used the legacy path. The managed client falls back only when session creation returns `503` or `501`, which normally means the server is not running `STORAGE_DRIVER=s3`.

### Bucket evidence

After a successful avatar change:

- `yugm-staging` (or the configured staging bucket) should not retain the completed object.
- `yugm-originals` (or configured originals bucket) contains the private original.
- `yugm-public-media` (or configured public-media bucket) contains the versioned avatar variants, including the 256px variant referenced by `User.avatar`.

### Failure map

| Symptom | Likely cause |
|---|---|
| `503` on `POST /api/media/uploads` | `STORAGE_DRIVER` is not `s3`, or a required bucket/public URL is missing. |
| Request goes to `/upload/avatar` | Client saw `503`/`501` and used the legacy fallback, or the installed artifact is old. |
| `403` on the presigned `PUT` | Grant expired, `Content-Type` does not match the signed header, wrong bucket, or credentials/endpoint mismatch. |
| `complete` returns `400` | Staged size, content type or image metadata did not match the declared upload; object may be missing from staging. |
| Avatar URL returns `404` | Public bucket access/custom domain is not enabled, or `R2_MEDIA_PUBLIC_URL` is wrong. |
| Auth fails before any upload | App Check/Play Integrity is not configured for the release certificate, or the server rejects the token. |
| Legacy avatar upload fails with `S3 storage requires S3_BUCKET and S3_REGION` | The legacy route was used but legacy S3 settings are unset; managed R2 is the intended path. |

## Security checklist

- [ ] No R2 account ID, access key, secret, bucket name, object key or signed URL in the APK, `BuildConfig`, source, tests, logs or analytics.
- [ ] `android-client/local.properties` and the upload keystore are not committed.
- [ ] The presigned PUT uses the non-logging OkHttp client and signed URLs are never logged or persisted.
- [ ] Private-media, originals and staging buckets are not public.
- [ ] Play App Signing is enrolled and the Play/upload certificate fingerprints are registered in Firebase.
- [ ] `APP_CHECK_ENFORCE` is enabled on the server only after Firebase Admin credentials and the release app registration exist.
- [ ] Credentials are rotated through the approved process if any value was ever exposed.

## Owner inputs still required

1. The release API host and socket host (exact HTTPS URLs; the repository must not invent a production domain).
2. The correct absolute path to the upload keystore.
3. Confirmation which deployed environment is the release target and that it has R2 configured.
4. Confirmation that Play Integrity is registered for the release signing certificate.
