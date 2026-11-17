# Cache and loading review

Reviewed against `0636b30` plus the existing pending chat/reaction changes. This review preserves and extends that work. No database migration, backend deployment, or APK release.

## Actual data paths

| Area | Current source of data | Behavior / limits |
|---|---|---|
| Chat | Bounded process memory conversation snapshots, then concurrent API refresh; socket updates while connected | Cache is now scoped by account/session and partner, expires after two minutes, retains at most 20 conversations and 200 messages each. This is not durable messaging or an offline send queue. |
| Reactions in chat/rooms | Shared process memory, then authenticated server catalog | Results include account-specific `usable`/VIP fields. Now scoped to the requesting session, bounded to four entries with two-minute TTL. Successful empty catalogs are cached; negative time deltas are not considered fresh. |
| Logout | SessionManager and app state | Clears conversation and reaction caches before dropping the session. New session keys also prevent late results for an old session being visible in a new login. |
| Discovery | Experience home API, falling back to trending/scheduled APIs | Existing rooms remain visible during room refresh; superseded room fetch jobs are canceled. There is no persistent discovery cache wired into this ViewModel. |
| Wallet | Server overview, coin packs, gifts, history | Loads independently in parallel. A gift/catalog/history failure no longer discards a successful balance response. Previous same-session data survives partial refresh failure; session change clears old wallet state. Balance remains server authoritative. |
| RoomRepository | Room SQLite snapshot then trending API, for callers of observeLiveRooms | Cached host details are restored; records older than five minutes are excluded/cleaned. Network failure keeps a valid cached snapshot, but cancellation is propagated. This repository currently has no observed screen call site: these improvements do not imply Party/Discovery already use disk caching. |
| Backend public room discovery | Redis JSON entries with 20-second expiry, otherwise Mongo | Keys include public room filters. Room mutation paths invalidate `rooms:*`; deployment Redis availability and cache-fill/invalidation races remain unverified. Cached counts are hints, not join authorization. |
| Images/GIFs | Existing Coil image loading | Not changed. Content cache headers, animated decoding and real-device rendering require device/network checks. |

## Confirmed fixes

- Partner-only conversation lookup could expose another account's cached conversation and VIP/profile state. Keys now include account and session; identity-dependent UI fields reset on connection changes.
- Reaction cache was global despite authenticated access fields. Both actual room/chat callers now pass immutable request scopes, cancel superseded catalog jobs and discard success from another session. Empty responses now have real TTL semantics.
- Chat refresh tasks read mutable destination fields from background jobs. They now freeze account/token/partner, cancel superseded refreshes and use a version guard for loading cleanup.
- Wallet's previous all-or-nothing sequential load lost successful overview data when a later request failed. Independent results now publish separately and partial failures are reported.
- Discovery no longer blanks its list before every room refresh; obsolete room filter requests cannot overwrite later requests.
- Room cache previously saved host ID/name/avatar but omitted the Host when mapping cached rows back to Room. Mapping now restores it and applies a bounded stale fallback.

## Validation

The focused cache command passed:

```powershell
.\gradlew.bat :core:api:testDebugUnitTest --tests com.yugm.app.core.api.ReactionCatalogCacheTest :feature:chat:testDebugUnitTest --tests com.yugm.app.feature.chat.cache.ChatConversationCacheTest :app:compileDebugKotlin
```

Five regressions cover account/session separation, VIP catalog isolation, empty response caching/expiry/clock rollback, logout clearing, immutable bounded message snapshots and LRU eviction. A subsequent `:app:compileDebugKotlin` passed after the Wallet/Discovery loading changes. These are not device navigation, offline network or ViewModel fault-injection tests.

## Still requiring work

1. **HTTP request identity:** YugmHttpClient can replace a supplied token with the currently stored token. Delayed old-account work can execute as the new account. Cache separation does not solve that transport issue; a same-account refresh/session contract is needed.
2. **Durable chat sync:** memory caching does not survive process death. Stable send IDs, a persistent pending command store, reconnect reconciliation, revisions/tombstones and confirmed read receipt recovery remain required. Retry cannot safely mean blindly sending a new command.
3. **Catalog freshness after entitlement changes:** session scope prevents cross-account mixing; purchases/expiry within one session may still display cached access until refresh/TTL. Server enforcement remains necessary. Cross-feature single-flight fetch coordination is not yet implemented.
4. **Other ViewModel races:** Event/Profile/ChatList and mutation-vs-refresh paths need the same identity/cancellation review. This pass is not a claim every screen has complete cache orchestration.
5. **Private data retention:** shared Room user-cache account partitioning and sign-out cleanup require a broader schema/call-site audit before storing private data there.
6. **Live validation:** run cold/warm loading, empty result, timeout, offline/online, account switch during delayed requests, revoked permissions, expired VIP, room ended while cached and image/GIF failures on supported devices.

Changes overlap the user's existing cache/ViewModel work. After local review and validation, these pending changes are included together at the user's explicit commit-and-push request.
