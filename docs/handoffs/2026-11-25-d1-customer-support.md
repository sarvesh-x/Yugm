# D1 customer support routes

Mounted the six legacy `/api/support` patterns in the shared D1 Worker. Signed-in users can create, list, read, reply to and close their own tickets. The public request endpoint accepts support, privacy and account-deletion requests with the existing 10-per-minute limit. Public submission creates a ticket for staff review. The optional username now accepts an omitted or blank value.

Customer and staff routes use the same D1 ticket and message tables. Reply order is assigned inside the transaction on both surfaces. A customer reply reopens a resolved ticket and rejects a closed ticket. The Android support client now uses paths relative to the configured `/api` base.

The audit reports 183 shared patterns and 455 legacy-only patterns. All six `/api/support` patterns are mounted. The next gaps still include 204 admin and 19 room patterns, plus other feature groups. Customer support uses the existing `0010` support sender schema.

Verification includes both Worker fixtures, the Worker typecheck, the Android `:core:api:compileDebugKotlin` task, the route audit and `git diff --check`. The Worker fixture exercises customer and staff round trips, cross-account denial, concurrent reply ordering, pagination, resolved and closed status handling, omitted username and public throttling. The Android APK was not rebuilt or installed. No hosted acceptance was performed.

Applied `0008` through `0010` to the emulator's existing local persistence directory and started the debug Worker on port 4000. Live loopback checks returned 200 for `/ready`, 401 for anonymous ticket listing and 422 for an invalid public request.
