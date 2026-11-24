# Handoff — Legacy direct-message contract

**Date:** 2026-11-23

Arcade score writes are deferred at the owner's request. This slice characterizes direct messaging without changing the running implementation. [HTTP fixture](../../backend-server/apps/api/src/routes/directMessages.characterization.test.ts)

## Observed behavior

- `POST /api/users/messages/:userId` normalizes message text, persists a new unread message and publishes to the sender and receiver with their respective partner IDs. It can mark unread messages from that recipient as read for the sender. The fixture verifies the notification record, user XP, relationship XP and the Battle Pass XP grant on a disposable MongoDB replica set.
- Two accepted identical legacy sends produce distinct message IDs, notifications and XP grants. The XP idempotency key derives from the saved message ID, so it cannot identify a retransmitted HTTP request. A future native retry key needs separate compatibility evidence. [Send route](../../backend-server/apps/api/src/routes/users.ts) · [Android API client](../../android-client/core/api/src/main/java/com/yugm/app/core/api/UserApi.kt)
- Passive history and before-cursor reads omit viewer-hidden messages and leave unread state intact. Default latest-history fetch marks matching inbound messages read after querying the returned page and publishes a sender receipt when it changes state. The explicit conversation-read endpoint only marks visible inbound messages, emits a sender receipt plus reader self-echo on a change, and emits only the reader self-echo on repeat.
- Conversation mute preserves both message events and omits the inbox notification. Blocking denies the send without inserting a message or publishing a direct event.

## Verification

- `npm.cmd exec --workspace @yugm/api -- tsx --test src/routes/directMessages.characterization.test.ts` passed 7/7, including the replica-set Battle Pass grant. An initial standalone MongoDB fixture exercised the normal message path but could not run the Battle Pass transaction, so the final test uses a disposable replica set.
- `npm.cmd run typecheck --workspace @yugm/api` and `git diff --check` passed. This pass did not rerun the full API suite.
- The test runs Express over loopback and captures outgoing Socket.IO packets at the broadcast adapter. It does not demonstrate device delivery, reconnect, native DO behavior or D1 parity. No cloud or production services were used.

Reuse this fixture at the local repository and realtime compatibility boundary. Any deduplication change needs to distinguish a retry of the same native command from a new user send with matching content. Socket.IO retirement and production cutover remain separately gated.
