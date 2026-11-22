# Handoff: release APK/AAB configuration for R2 media

**Date:** 2026-11-22  
**Status:** Documentation complete; release execution not started. No build, signing, deploy, credential change or production operation was performed.

## What was done

- Added [release APK/AAB configuration](../features/release-build-configuration.md) covering:
  - the server-only R2 boundary and the managed upload sequence;
  - Gradle property precedence and release-enforced checks;
  - `YUGM_UPLOAD_KEYSTORE_FILE` resolution relative to `android-client/app`;
  - AAB/APK build commands;
  - Node and Worker server-side R2 configuration, including `S3_*` precedence and `S3_BUCKET` fallback;
  - expected network sequence, bucket evidence, failure map and security checklist.
- Linked it from [the R2 media doc](../features/r2-centralized-media.md#release-clients), [the Play checklist](../play-store-release-checklist.md) and [the documentation index](../INDEX.md).
- Added the release property block and a signed-artifact R2 verification step to the Play checklist.
- Recorded the task in `docs/CURRENT_TASK.md` (YUGM-RELEASE-001) and `docs/DEVELOPMENT_PROGRESS.md`.

## Local findings

Key-presence checks only; no values were printed.

- `android-client/local.properties` has `YUGM_SERVER_MODE` set to deploy and all four upload-signing keys populated.
- Missing: `YUGM_API_BASE_URL`, `YUGM_SOCKET_BASE_URL`, `YUGM_VERSION_CODE`, `YUGM_VERSION_NAME`.
- The configured keystore path did not resolve to an existing file from either the repository root or `android-client/app`.
- Without explicit URLs, the release build uses the staging Worker default, which still sets `STORAGE_DRIVER=mongodb`.
- R2 local configuration remains validated from YUGM-R2-002; tracked Wrangler configs remain unchanged.

## Verification performed

- Read-only inspection of `android-client/app/build.gradle.kts`, `YugmApplication.kt`, `MediaUploadApi.kt`, `RoomApi.kt`, `ApiConfig.kt`, Worker configs and API R2 env resolution.
- Key-presence, URL-scheme and keystore-existence checks against the ignored local properties.
- Documentation link check and `git diff --check`.

Not run: Gradle release build, signing, install, device QA, live R2 upload, deploy, release.

## Next steps

1. Owner supplies the exact release API and socket hosts.
2. Owner corrects `YUGM_UPLOAD_KEYSTORE_FILE` to an existing absolute path and sets the version code/name.
3. Confirm the release target environment has `STORAGE_DRIVER=s3`, all five buckets and both public URLs, and that Play Integrity is registered for the release certificate.
4. Build the bounded release artifact, install it on a physical device and verify `POST /api/media/uploads` → presigned R2 `PUT` → `/complete` → public avatar URL.
5. Do not switch tracked Wrangler configs, deploy or publish without separate approval.
