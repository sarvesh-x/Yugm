# Local Google sign-in recovery

The Android debug build reached `POST /api/auth/google` at `10.0.2.2:4000` and received HTTP 409. Firebase verified the credential. Yugm rejected the exchange because the email already belonged to a local profile linked to a different Firebase UID. The available Firebase Admin credential could not verify the status of the previous identity. [Firebase account linking](https://firebase.google.com/docs/auth/android/account-linking)

Created a separate local Wrangler persistence directory and applied migrations `0001` through `0005` to its `yugm` database, including the reference catalogs. The original local D1 and R2 files remain in the default Wrangler state directory. The auth conflict checks remain in effect. The initial retry timed out because two local Wrangler instances were competing for port 4000. After stopping both and starting one Worker, the emulator received HTTP 200 from `/ready`. An empty Google exchange reached validation and returned HTTP 422.

At 20:50:35 local time, the owner retried Google sign-in on the emulator. The Google exchange and device-token registration both returned HTTP 200. A local comparison confirmed the same email, different Firebase UIDs and an active session in the new database. The isolated Auth Worker fixture also passed, including its account-link protections. The new persistence directory has its own local profile and local R2 objects.

From `backend-server`, reuse the recovered local data with PowerShell.

```powershell
$localState = Join-Path (Get-Location) 'apps/cloudflare-worker/auth-local/.wrangler/local-sign-in-2026-11-24'
npm.cmd run dev -- --persist-to $localState
```

Plain `npm run dev` selects the original default persistence directory. Run one debug Worker on port 4000 at a time. The original profile still requires an identity reconciliation before it can be used with the new Firebase UID. This recovery used local D1 and R2 only. It required no APK rebuild.
