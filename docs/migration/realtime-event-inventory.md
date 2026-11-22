# Realtime event inventory

**Date:** 2026-11-22  
**Status:** Phase 0 working inventory, complete for backend and Android. No protocol or migration decision is committed here. This is the source-verified input to [DCR-3](../cloudflare-migration/decision-request.md) and the [realtime migration plan](realtime-plan.md).

## 1. Purpose

Every realtime event must be classified as durable message, ephemeral presence/typing, invalidation, admin notification, RTC signaling, PK/financial side effect or unknown before a protocol is chosen. Socket success is never proof of a committed command.

## 2. Sources and path aliases

| Alias | Base path |
|---|---|
| `api/` | `backend-server/apps/api/src/` |
| `shared/` | `backend-server/packages/shared/src/` |
| `a-core/` | `android-client/core/api/src/main/java/com/yugm/app/core/api/` |
| `a-feature/` | `android-client/feature/` |
| `admin/` | `backend-server/apps/admin/src/` |

Sources: `shared/index.ts` (`socketEvents`), `api/services/pk.ts` (`pkSocketEvents`), `api/services/socket.ts` (handshake, rooms, emit helpers, rate limits), `api/middleware/syncInvalidation.ts` (mutation→topic mapping), API routes/services, `a-core/SocketManager.kt`, `a-core/YugmSocket.kt`, `a-core/AppSync.kt`, feature ViewModels, `admin/`, and `docs/production/socket-inventory.csv`.

The table was produced by a read-only source extraction and then spot-checked against source for the catalog count, the typing-auth gap, the dead `voice:room:presence` listeners, the PK force-end path and the admin client. No build, test or runtime verification was performed.

## 3. Catalog facts (source-verified)

- `socketEvents` at `shared/index.ts:49–97` contains **47** entries (lines 50–96), not 48. Earlier Phase 0 documents said 48 and are corrected by this inventory.
- No payload schemas or TypeScript event-payload types are defined alongside `socketEvents`. The Zod schemas in the same file (for example `chatMessageSchema:625`, `sendGiftSchema:644`, `reactionSchema:705`) validate HTTP bodies, not socket payloads.
- `pkSocketEvents` at `api/services/pk.ts:24–41` contains **16** entries, with no payload types. `emitPkState()` (`:146–150`) emits the `pkState()` shape defined at `:119–143`.
- Engine lifecycle events (`connection`, `disconnecting`, `disconnect`) are transport events, not application events. Android uses `Socket.EVENT_CONNECT`, `CONNECT_ERROR` and `DISCONNECT` (`a-core/SocketManager.kt:84,121,323`; `a-core/YugmSocket.kt:62,76`).
- Emit helpers are `emitRoom`, `emitUser` and `emitClanMembers` (`api/services/socket.ts:402–419`); none authorizes recipients itself.
- Rooms are `user:<id>` and `room:<id>`. Socket-level rate limiting is 10 packets/second via Redis (`api/services/socket.ts:354–371`).

## 4. Static inventory reconciliation

`docs/production/socket-inventory.csv` has **11 data rows**, all `NOT VERIFIED`, all confined to `api/services/socket.ts`: auth middleware, `connection`, `roomJoin`, `roomLeave`, DM typing start/stop, clan typing start/stop, `disconnecting`, `disconnect` and the socket rate-limit middleware. It does not cover PK events, literal events, route/service emitters, Android consumers or admin consumers.

Its recorded line numbers are stale: the CSV cites auth at `:192`, `connection` at `:222`, `roomJoin` at `:240` and the rate limiter at `:326`; current source places these at `api/services/socket.ts:220–248`, `:250`, `:268` and `:354–371`. The CSV must not be used as the protocol-decision input; this document supersedes it.

## 5. Sync-topic and dead-listener findings

- Server `api/middleware/syncInvalidation.ts:5–26` maps mutations to 11 topics: `PROFILE`, `SOCIAL`, `CHAT`, `ROOMS`, `CLANS`, `WALLET`, `GIFTS`, `TASKS`, `EVENTS`, `NOTIFICATIONS`, `SETTINGS`.
- Android `AppSync.SyncTopic` (`a-core/AppSync.kt:16`) declares 13, adding `ALL` and `BONDS`.
- `BONDS` has no server emitter. Bond mutations emit `bonds:changed` from `api/services/bonds.ts:95`; `AppSync.kt:45,50` mirrors `bonds → BONDS` and additionally invalidates `WALLET`, then `SocketManager.kt:116` maps `BONDS` to `WALLET,PROFILE`.
- `voice:room:presence:started|updated|ended` are Android-only listeners (`a-core/SocketManager.kt:108,153,163,173`) with no emit site in `apps/api/src` (grep returned no matches). They are dead or externally produced; the migration must decide their fate.
- Admin SPA: grep for `socket`, `Socket`, `EventSource` and `realtime` across `admin/` returned no matches. No admin realtime consumer was found; all `Admin consumer` cells below are "None found".
- Managed avatar completion emits `PROFILE,TASKS`; legacy `/upload/avatar` emits `PROFILE`; other `/media/*` mutations are intentionally silent.

## 6. Event-by-event table

`NV` in earlier drafts is now resolved for admin (no consumer found) and for the static inventory (section 4). "Durable write" means an authoritative database write was traced before the emit; "caller" means authorization exists in the calling route but not in the emit helper.

| Event | Catalog | Direction | Payload | Scope | Emit sites | Listen sites | Auth | Durable write before emit | Android consumer | Admin consumer | Classification | Migration risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `room:join` | `socketEvents:50` | C→S, ack | `{roomId?}` | room join | — | `api/services/socket.ts:268` | Handshake JWT `:220–248`; room LIVE, active participant `:272–278` | No; join and Redis flag clear `:279–281` | `a-core/YugmSocket.kt:65` with ack `:65–74` | None found | Ephemeral presence | High: ack semantics and join checks |
| `room:leave` | `:51` | C→S | `{roomId}` | room leave | — | `api/services/socket.ts:289` | Handshake only | Indirect; 15s delayed DB exit `:90–110` | No emit found | None found | Ephemeral presence | Medium: delayed write needs DO/queue |
| `room:participant:update` | `:52` | S→C | Many actions: `disconnect`, `join`, `leave`, `settings_updated`, `user_unmuted`, `chat_cleared`, `seat_lock_changed`, `seat_taken`, `seat_changed`, `speaker_invited`, `speaker_removed`, `admin_promoted`, `admin_removed`, `co_host_added` | `room:<id>`; co-host also `user:<id>` | `socket.ts:102`; `api/routes/rooms.ts:483,503,550,558,573,583,596,650,668,689,722,744,775,796` | `a-core/YugmSocket.kt:186`; `a-feature/room/RoomViewModel.kt:568,712,725,756,776,828,871,1257` | Caller routes auth-scoped; helpers unguarded `:402–409` | Yes, participant/room mutation precedes emit | Yes | None found | Ephemeral presence | Medium: undocumented action enum duplicated in client |
| `room:chat:message` | `:53` | S→C | `{message: populated}` | `room:<id>` | `api/routes/rooms.ts:1052`; `api/routes/wallet.ts:603` | `a-core/YugmSocket.kt:79` | Caller route | Yes, message persisted before emit | Yes `:79–90` | None found | Durable message | High: ordering and replay vs HTTP history |
| `room:gift:send` | `:54` | S→C | Gift payload `api/routes/wallet.ts:586` | `room:<id>` | `api/routes/wallet.ts:586` | `a-core/YugmSocket.kt:195–220`, handler `:203–217` | Caller route | Yes, wallet debit and gift transaction | Yes | None found | PK/financial side effect | High: money event, idempotency needed |
| `room:reaction:send` | `:55` | S→C | Payload at `api/routes/rooms.ts:876` | `room:<id>` | `api/routes/rooms.ts:876` | `a-core/YugmSocket.kt:143` | Caller route | Likely reaction write, body not fully read | Yes `:143–165` | None found | Durable message | Medium: `reactionId`/`type` aliases need parity test |
| `room:activity:new` | `:56` | S→C | `{activity}` | `room:<id>` | `api/routes/rooms.ts:61`; `api/routes/wallet.ts:612` | `a-core/YugmSocket.kt:195–220` | Caller route | Yes, `RoomActivity` stored, guarded at `wallet.ts:612` | Yes, generic | None found | Durable message | Low/Medium |
| `room:poll:new` | `:57` | S→C | `{poll}` | `room:<id>` | `api/routes/rooms.ts:899` | `a-core/YugmSocket.kt:195–220`; `RoomViewModel.kt:828,904` | Caller route | Yes, `Poll` write | Yes, generic | None found | Durable message | Medium |
| `room:poll:vote` | `:58` | S→C | `{poll: updated}` | `room:<id>` | `api/routes/rooms.ts:932` | `a-core/YugmSocket.kt:195–220`; `RoomViewModel.kt:828,927` | Caller route | Yes, vote recorded | Yes, generic | None found | Durable message | Medium: duplicate-vote replay |
| `room:poll:closed` | `:59` | S→C | `{poll: closed}` | `room:<id>` | `api/routes/rooms.ts:910,946` | `a-core/YugmSocket.kt:195–220`; `RoomViewModel.kt:828,949` | Caller route | Yes | Yes, generic | None found | Durable message | Medium |
| `room:speaker:request` | `:60` | S→C | `{request}` | `room:<id>` | `api/routes/rooms.ts:610` | `a-core/YugmSocket.kt:195–220`; `RoomViewModel.kt:686,828` | Caller route | Yes, `SpeakerRequest` write | Yes, generic | None found | Durable message | Medium |
| `room:speaker:approve` | `:61` | S→C | `{userId, seatIndex}` | `room:<id>` | `api/routes/rooms.ts:628,646,688` | `a-core/YugmSocket.kt:166,195–220`; `RoomViewModel.kt:542,698,828,871` | Caller route, host/mic checks | Yes, participant seat write | Yes | None found | Durable message | Medium |
| `room:speaker:reject` | `:62` | S→C | `{userId}` | `room:<id>` | `api/routes/rooms.ts:699` | `a-core/YugmSocket.kt:195–220`; `RoomViewModel.kt:828,884` | Caller route | Yes | Yes, generic | None found | Durable message | Medium |
| `room:user:mute` | `:63` | S→C | `{userId}` | `room:<id>` | `api/routes/rooms.ts:710,745` | `a-core/YugmSocket.kt:174,195–220`; `RoomViewModel.kt:828` | Caller route | Yes, mute write | Yes | None found | Durable message | Medium |
| `room:user:remove` | `:64` | S→C | `{userId}` | `room:<id>` | `api/routes/rooms.ts:761` | `a-core/YugmSocket.kt:180,195–220`; `RoomViewModel.kt:828` | Caller route | Yes | Yes | None found | Durable message | Medium |
| `room:ended` | `:65` | S→C | `{roomId, reason}` | `room:<id>` plus public `ROOMS` invalidation | `api/services/socket.ts:103,157`; `api/routes/rooms.ts:510,531`; `api/routes/admin.ts:984,1103` | `a-core/YugmSocket.kt:195–220`; `RoomViewModel.kt:810,815,828` | Caller auth; `emitRoom` auto-invalidates `ROOMS` `socket.ts:403` | Yes, `endRoom()` before emit | Yes, generic | None found | Durable message | High: termination plus public invalidation coupling |
| `user:online` | `:66` | S→C | `{userId}` | Public broadcast | `api/services/socket.ts:265` | `a-core/SocketManager.kt:307`; `DiscoverViewModel.kt:53`, `ChatViewModel.kt:202`, `ChatListViewModel.kt:154` | Handshake only | No; Redis presence `:257,261` | Yes | None found | Ephemeral presence | Medium: multi-instance fan-out via Redis snapshot `:176–180` |
| `user:offline` | `:67` | S→C | `{userId}` | Public broadcast | `api/services/socket.ts:346` | `a-core/SocketManager.kt:315`; same consumers as online | Handshake; only when no session remains `:343–346` | No; Redis deletion | Yes | None found | Ephemeral presence | Medium |
| `direct:typing:start` | `:68` | C→S | `{userId: target}` | target user | — | `api/services/socket.ts:294` | **Handshake plus ObjectId format only, no conversation check** `:295` | No | Emits `a-core/SocketManager.kt:336` | None found | Ephemeral presence | High: any authenticated socket can spoof typing to any user |
| `direct:typing:stop` | `:69` | C→S | `{userId: target}` | target user | — | `api/services/socket.ts:299` | Same gap `:300` | No | Emits `a-core/SocketManager.kt:336` | None found | Ephemeral presence | High |
| `direct:typing:update` | `:70` | S→C | `{userId, typing}` | `user:<target>` | `api/services/socket.ts:296,301` | `a-core/SocketManager.kt:214`; `ChatViewModel.kt:196` | Inherits unauthenticated-authorized start/stop | No | Yes | None found | Ephemeral presence | High: inherits spoofing gap |
| `direct:message:new` | `:71` | S→C | `{message, partnerId, roomId?, updated?}` | both `user:*` | `api/routes/users.ts:1022,1023,1046,1047,1185,1186,1263,1264`; `games.ts:301,302`; `rooms.ts:965,966,1025,1026`; `wallet.ts:675,676` | `a-core/SocketManager.kt:132,106`; `ChatViewModel.kt:141`; `ChatListViewModel.kt:104` | Caller route | Yes, `DirectMessage` persisted | Yes | None found | Durable message | High: duplicate delivery and read-state races |
| `direct:message:deleted` | `:72` | S→C | `{messageId, partnerId}` | both `user:*` | `api/routes/users.ts:1098,1099,1113,1114` | `a-core/SocketManager.kt:190,106`; `ChatViewModel.kt:169`; `ChatListViewModel.kt:84` | Caller route | Yes, DB delete before emit | Yes | None found | Durable message | Medium |
| `direct:conversation:deleted` | `:73` | S→C | `{partnerId}` | `user:<partner>` and actor | `api/routes/users.ts:425,1063` | `a-core/SocketManager.kt:196,106`; `ChatViewModel.kt:172`; `ChatListViewModel.kt:75` | Caller route | Yes | Yes | None found | Durable message | Medium |
| `direct:message:read` | `:74` | S→C | `{partnerId, readThrough}` | senders and actor | `api/routes/users.ts:865,880,996,1181` | `a-core/SocketManager.kt:202`; `ChatViewModel.kt:180`; `ChatListViewModel.kt:132` | Caller route | Yes, guarded by `modifiedCount > 0` `:996` | Yes | None found | Durable message | Medium: `readThrough` ordering |
| `direct:conversation:read` | **Off-catalog** | S→C | `{partnerId, readThrough}` | actor only, self-echo | `api/routes/users.ts:866,881,884,1182` | `a-core/SocketManager.kt:208`; `ChatListViewModel.kt:135` | Caller route | Yes | Yes | None found | Invalidation | Medium: self-echo must survive fan-out change |
| `direct:reaction:new` | **Off-catalog** | S→C | `{message: updated, partnerId}` | `user:<partner>` | `api/routes/users.ts:1319` | `a-core/SocketManager.kt:181,106`; `ChatViewModel.kt:163`; `ChatListViewModel.kt:125` | Caller route | Yes, reaction stored | Yes | None found | Durable message | Medium: literal string drift |
| `group:message:new` | `:75` | S→C | `{groupId, message}` | participants except sender | `api/routes/groups.ts:83` | None found | Caller route plus `requireGroupParticipant` `:15–22` | Yes, `GroupMessage` write | No | None found | Durable message | Medium: no Android consumer, parity gap |
| `group:created` | `:76` | S→C | `{group: populated}` | participants except creator | `api/routes/groups.ts:42`, helper `:24–28` | None found | Caller route plus participant helper | Yes, `GroupChat.create` `:33` | No | None found | Durable message | Medium: per-user fan-out |
| `group:participant:add` | `:77` | S→C | `{groupId, group, addedUserIds}` | participants except actor | `api/routes/groups.ts:114` | None found | Caller route plus participant check | Yes | No | None found | Durable message | Medium |
| `group:participant:remove` | `:78` | S→C | `{groupId, group, removedUserId}` | remaining and removed users | `api/routes/groups.ts:132,154` | None found | Caller route plus participant check | Yes | No | None found | Durable message | Medium |
| `clan:typing:start` | `:79` | C→S | `{clanId}` | clan members | — | `api/services/socket.ts:304` | Handshake, ObjectId and **membership** `:306–307` | No | Emits `a-core/SocketManager.kt:341` | None found | Ephemeral presence | Low/Medium |
| `clan:typing:stop` | `:80` | C→S | `{clanId}` | clan members | — | `api/services/socket.ts:314` | Membership check `:316` | No | Emits `a-core/SocketManager.kt:341` | None found | Ephemeral presence | Low/Medium |
| `clan:typing:update` | `:81` | S→C | `{clanId, userId, typing}` | members except sender | `api/services/socket.ts:310,320` | `a-core/SocketManager.kt:301`; `ClanViewModel.kt:100` | Membership-gated upstream | No | Yes | None found | Ephemeral presence | Medium: N user emits per keystroke |
| `clan:message:new` | `:82` | S→C | `{clanId, message}` | clan members except sender `:443` | `api/routes/clans.ts:443` | `a-core/SocketManager.kt:220,107`; `ClanViewModel.kt:75` | Caller route plus member list `socket.ts:411–419` | Yes, `ClanMessage` write | Yes | None found | Durable message | High: per-member fan-out, duplicate delivery |
| `clan:message:deleted` | `:83` | S→C | `{clanId, messageId}` | clan members | `api/routes/clans.ts:498` | `a-core/SocketManager.kt:230,107`; `ClanViewModel.kt:82` | Caller route plus member list | Yes | Yes | None found | Durable message | Medium |
| `clan:message:updated` | `:84` | S→C | `{clanId, message: updated}` | clan members | `api/routes/clans.ts:486` | `a-core/SocketManager.kt:236,107`; `ClanViewModel.kt:87` | Caller route plus member list | Yes | Yes | None found | Durable message | Medium |
| `clan:chat:cleaned` | `:85` | S→C | `{clanId}` | clan members | `api/routes/clans.ts:506`; `api/routes/admin.ts:1141` | `a-core/SocketManager.kt:246,107`; `ClanViewModel.kt:97` | Caller or admin route | Yes, messages cleared | Yes | None found | Durable message | Medium |
| `clan:updated` | `:86` | S→C | `{clanId, clan: mapped}` | members except actor `:359` | `api/routes/clans.ts:359` | `a-core/SocketManager.kt:252,107`; `ClanViewModel.kt:105` | Caller route plus member list | Yes | Yes | None found | Durable message | Medium |
| `clan:deleted` | `:87` | S→C | `{clanId}` | former members except actor `:413` | `api/routes/clans.ts:413` | `a-core/SocketManager.kt:260,107`; `ClanViewModel.kt:106` | Caller route | Yes, clan deleted | Yes | None found | Durable message | Medium |
| `clan:member:joined` | `:88` | S→C | `{clanId, userId, clan}` | members except joiner `:328` | `api/routes/clans.ts:328,582` | `a-core/SocketManager.kt:266,107`; `ClanViewModel.kt:107,133` | Caller or invite route | Yes | Yes | None found | Durable message | Medium |
| `clan:member:left` | `:89` | S→C | `{clanId, userId, clan}` | members and leaver | `api/routes/clans.ts:607,612,613` | `a-core/SocketManager.kt:273,107`; `ClanViewModel.kt:107` | Caller route | Yes | Yes | None found | Durable message | Medium: duplicate emits at `:612` and `:613` |
| `clan:member:removed` | `:90` | S→C | `{clanId, userId, clan}` | target and members | `api/routes/clans.ts:398,399` | `a-core/SocketManager.kt:280,107`; `ClanViewModel.kt:107` | Caller route with role checks | Yes | Yes | None found | Durable message | Medium |
| `clan:member:role_updated` | `:91` | S→C | `{clanId, userId, role, clan}` | clan members | `api/routes/clans.ts:375` | `a-core/SocketManager.kt:287,107`; `ClanViewModel.kt:107` | Caller route with owner/admin checks | Yes | Yes | None found | Durable message | Medium |
| `clan:ownership:transferred` | `:92` | S→C | `{clanId, fromUserId, toUserId, clan}` | clan members | `api/routes/clans.ts:342` | `a-core/SocketManager.kt:294,107`; `ClanViewModel.kt:107` | Caller route with owner check | Yes | Yes | None found | Durable message | Medium |
| `notification:new` | `:93` | S→C | `{notification}` | `user:<id>` | `api/services/notifications.ts:75`, called e.g. `services/pk.ts:461` | `a-core/SocketManager.kt:145,109`; `MainViewModel.kt:84`; `NotificationsViewModel.kt:40` | Internal service call, no socket-level check | Yes, `createNotification` persists `pk.ts:460–465` | Yes | None found | Admin notification / durable | High: persist then deliver exactly once |
| `room:watchparty:started` | `:94` | S→C | `{watchParty: wp}` | `room:<id>` | `api/routes/watchparty.ts:38` | None found | Caller route | Yes, `WatchParty` write | No | None found | Durable message | Medium: no Android consumer |
| `room:watchparty:stopped` | `:95` | S→C | `{}` | `room:<id>` | `api/routes/watchparty.ts:64` | None found | Caller route | Yes, state update | No | None found | Durable message | Medium |
| `room:watchparty:sync` | `:96` | S→C | `{position, isPlaying}` | `room:<id>` | `api/routes/watchparty.ts:57` | None found | Caller route | Yes, position persisted | No | None found | Durable message | Medium |
| `bonds:changed` | **Off-catalog** | S→C | `{at, version, eventId}` | `user:<id>` per affected user | `api/services/bonds.ts:95` | `a-core/SocketManager.kt:110,116`; mapped to `WALLET,PROFILE` | Internal service call | Yes, bond mutation and version bump | Yes, invalidation only | None found | Invalidation | Medium: no payload parity test; no `BONDS` server topic |
| `sync:invalidate` | **Off-catalog** | S→C | `{topics: string[]}` | actor `user:<id>` `api/middleware/syncInvalidation.ts:34,41` and public broadcast `socket.ts:35`, 500ms coalesced | `api/services/socket.ts:35`; `api/middleware/syncInvalidation.ts:34,41` | `a-core/SocketManager.kt:97–104`; `AppSync.invalidate`; `AutomaticSyncEffect.kt:36` | Private path only on 2xx with `req.user.id`; public path has no recipient auth | Yes, HTTP mutation committed via `res.once("finish")` 2xx gate | Yes | None found | Invalidation | High: dual private/public paths, topic parity including `BONDS` |
| `admin:room:lock` | **Off-catalog** | S→C | `{roomId}` | `room:<id>` | `api/routes/admin.ts:998` | None found | Admin route, permission middleware not traced | Room lock DB update before emit | No | None found | Admin notification | Medium |
| `admin:room:unlock` | **Off-catalog** | S→C | `{roomId}` | `room:<id>` | `api/routes/admin.ts:1004` | None found | Admin route | DB update before emit | No | None found | Admin notification | Medium |
| `admin:room:user:remove` | **Off-catalog** | S→C | `{userId}` | `room:<id>` | `api/routes/admin.ts:1010` | None found | Admin route | DB participant removal before emit | No | None found | Admin notification | Medium |
| `admin:room:user:mute` | **Off-catalog** | S→C | `{userId}` | `room:<id>` | `api/routes/admin.ts:1016` | None found | Admin route | DB mute before emit | No | None found | Admin notification | Medium |
| `admin:room:warning` | **Off-catalog** | S→C | `{message: sanitizeText(...), adminId}` | `room:<id>` | `api/routes/admin.ts:1031` | None found | Admin route | No DB write evident, ephemeral | No | None found | Admin notification | Medium |
| `recording:started` | **Off-catalog** | S→C | `{recordingId}` | `room:<id>` | `api/routes/recordings.ts:59` | None found | Caller route | Yes, `RoomRecording` created | No | None found | Durable message | Medium |
| `recording:stopped` | **Off-catalog** | S→C | Payload at `api/routes/recordings.ts:77` | `room:<id>` | `api/routes/recordings.ts:77` | None found | Caller route | Yes, recording finalized | No | None found | Durable message | Medium |
| `room:mode:set` | **Off-catalog** | S→C | `{mode, state}` | `room:<id>` | `api/routes/roomModes.ts:169` | `a-core/YugmSocket.kt:195–220`; `RoomModesViewModel.kt:44` | Caller route | Yes, mode state written | Yes, generic | None found | Durable message | Medium: client duplicates event string list |
| `room:mode:state` | **Off-catalog** | S→C | `{state}` | `room:<id>` | `api/routes/roomModes.ts:239,300` | Same as above | Caller route | Yes, `RoomModeState` write | Yes | None found | Durable message | Medium |
| `room:mode:answer` | **Off-catalog** | S→C | `{userId, round}` | `room:<id>` | `api/routes/roomModes.ts:323` | Same as above | Caller route | Yes, answer stored | Yes | None found | Durable message | Medium |
| `room:mode:dare` | **Off-catalog** | S→C | `{dare, targetUserId}` | `room:<id>` | `api/routes/roomModes.ts:337` | Same as above | Caller route | Yes, dare recorded | Yes | None found | Durable message | Medium |
| `room:mode:scores` | **Off-catalog** | S→C | `{scores}` | `room:<id>` | `api/routes/roomModes.ts:350` | Same as above | Caller route | Yes, scores persisted | Yes | None found | Durable message | Medium |
| `room:mode:ended` | **Off-catalog** | S→C | `{state}` | `room:<id>` | `api/routes/roomModes.ts:358` | Same as above | Caller route | Yes | Yes | None found | Durable message | Medium |
| `voice:room:presence:started` | **Off-catalog** | Android listen only | `{userId, presence or voiceRoomPresence}` | Assumed `user:<id>` | **No server emit found** | `a-core/SocketManager.kt:108,153`; `ProfileViewModel.kt:83` | N/A | N/A | Yes, never received from this API | None found | Unknown | High: dead listener or external producer |
| `voice:room:presence:updated` | **Off-catalog** | Android listen only | Same as above | Assumed `user:<id>` | **No server emit found** | `a-core/SocketManager.kt:108,163`; `ProfileViewModel.kt:83` | N/A | N/A | Yes | None found | Unknown | High |
| `voice:room:presence:ended` | **Off-catalog** | Android listen only | `{userId}` | Assumed `user:<id>` | **No server emit found** | `a-core/SocketManager.kt:108,173`; `ProfileViewModel.kt:91` | N/A | N/A | Yes | None found | Unknown | High |
| `pk:invite:received` | `pk:25` | S→C | `{invite, battle: state}` | `user:<opponentHostId>` | `api/services/pk.ts:464` | `a-core/YugmSocket.kt:96–107` | `assertHost` `:402`, block check `:407–413` | Yes, transactional battle plus invite plus events `pk.ts:419–456` and notification `:461` | Yes | None found | PK/financial side effect | High |
| `pk:invite:sent` | `pk:26` | S→C | `{invite, battle: state}` | `room:<inviterRoomId>` | `api/services/pk.ts:465` | `a-core/YugmSocket.kt:114–118` | Same as above | Yes | Yes | None found | PK/financial side effect | High |
| `pk:invite:accepted` | `pk:27` | S→C | Full PK state | `user:<leftHostId>` | `api/services/pk.ts:536` | `a-core/YugmSocket.kt:91–95` | Invitee-only `:499`, pending/expiry `:500–504` | Yes, battle and participants `pk.ts:513–534` | Yes | None found | PK/financial side effect | High |
| `pk:invite:rejected` | `pk:28` | S→C | `{battleId, inviteId}` | `room:<leftRoomId>` | `api/services/pk.ts:575` | `a-core/YugmSocket.kt:114–118` | Invitee-only `:544` | Yes `pk.ts:553–572` | Yes | None found | PK/financial side effect | High |
| `pk:invite:expired` | `pk:29` | S→C | `{battleId, inviteId}` | `room:<leftRoomId>` and `user:<inviteeId>` | `api/services/pk.ts:969,970` | `a-core/YugmSocket.kt:114–118` | Internal timer, skipped on Cloudflare runtime `pk.ts:976` | Yes `pk.ts:945–960` | Yes | None found | PK/financial side effect | High: timers disabled, DO alarm needed |
| `pk:started` | `pk:30` | S→C | Full PK state | both rooms via `emitPkState` `:146–150` | `api/services/pk.ts:223,1054` | `a-core/YugmSocket.kt:91–95` | Status CAS `COUNTDOWN→ACTIVE` `:214–218,1047–1055` | Yes, `PkBattle` plus `PkEvent` | Yes | None found | PK/financial side effect | High |
| `pk:state` | `pk:31` | S→C | Full `pkState()` object | both rooms | `api/services/pk.ts:176,186,191,382,535,626,1011,1043,146` | `a-core/YugmSocket.kt:91–95` | Caller-level checks; helper unguarded | Usually yes, `setPkReady` writes `:157–175` | Yes | None found | PK/financial side effect | High: `stateVersion` at `:125` is the only ordering guard |
| `pk:score:update` | `pk:32` | S→C | Full PK state | both rooms | `api/services/pk.ts:719,840,900` | `a-core/YugmSocket.kt:91–95` | `requirePkParticipant` `:258–265`, side/self checks `:786–787,877` | Yes, wallet debit or vote or reaction `pk.ts:796–832,701–709,887–899` | Yes | None found | PK/financial side effect | High: monetary replay; idempotency key `:767–775,860–865` |
| `pk:lead:changed` | `pk:33` | S→C | `{battleId, leader, leftScore, rightScore}` | both rooms, dedup `:837` | `api/services/pk.ts:836,837,896,897` | `a-core/YugmSocket.kt:119–132` | Same PK participant checks | Yes, `PkEvent LEAD_CHANGED` `:835,895` | Yes | None found | PK/financial side effect | High: derived state can interleave with `pk:state` |
| `pk:gift:received` | `pk:34` | S→C | `{battleId, side, senderId, giftId, giftName, coinAmount, quantity, pointsAdded, combo, leftScore, rightScore}` `pk.ts:841–853` | both rooms | `api/services/pk.ts:854,855` | `a-core/YugmSocket.kt:108–110`, parse `:242` | Participant, opposing-side and self-gift checks `:783–787` | Yes, wallet debit and `GiftTransaction` committed `:832` | Yes | None found | PK/financial side effect | High |
| `pk:reaction:received` | `pk:35` | S→C | `{battleId, side, type, pointsAdded, bucketRemaining}` | both rooms | `api/services/pk.ts:901,902` | `a-core/YugmSocket.kt:111–113` | Participant and own-side check `:875–877`; in-memory 10pt/10s bucket `:878–885` | Yes, score update plus `PkEvent` `:887–899` | Yes | None found | PK/financial side effect | High: process-local rate bucket fails across Workers |
| `pk:timer:tick` | `pk:36` | S→C | Full PK state | both rooms | `api/services/pk.ts:228,1016,1017` | `a-core/YugmSocket.kt:91–95` | Internal timer `:986–994`, disabled on Cloudflare `:988`; `runPkDeadlines :1025` | Yes for countdown transitions, tick itself ephemeral | Yes | None found | PK/financial side effect | High: DO alarm replacement required |
| `pk:ended` | `pk:37` | S→C | Full PK state | both rooms | `api/services/pk.ts:576,599,644,676,968` | `a-core/YugmSocket.kt:91–95` | Host/admin checks `:610–615` or internal timer/rejection | Yes, terminal status plus `PkEvent` `:628–644` | Yes | None found | PK/financial side effect | High |
| `pk:force_ended` | `pk:38` | S→C | Full PK state | both rooms | `api/services/pk.ts:644` | `a-core/YugmSocket.kt:91–95` | `input.force` **bypasses host check at `:610`**; caller must be trusted admin (verified in source) | Yes, `ABORTED` plus `PK_ABORTED` `:638–643` | Yes | None found | PK/financial side effect | High: force path authorization is caller-dependent |
| `pk:rematch:requested` | `pk:39` | S→C | `{battleId, previousBattleId, userId}` | `user:<opponentHostId>` | `api/services/pk.ts:751` | `a-core/YugmSocket.kt:133–142` | Host and live-room checks `:730–740` | Yes, new invite `:741–750` | Yes | None found | PK/financial side effect | High |
| `pk:error` | `pk:40` | — | None | — | **No emit found** | **No listen found** | N/A | N/A | No | None found | Unknown | Low: catalog-only dead entry |

## 7. Findings

### Catalog drift

- 47 shared events and 16 PK events are cataloged; 17 emitted/listened names are absent from both catalogs: `sync:invalidate`, five `admin:room:*` events, `bonds:changed`, two `recording:*` events, six `room:mode:*` events, `direct:conversation:read` and `direct:reaction:new`.
- Three further names (`voice:room:presence:started|updated|ended`) are Android-only with no server emit found.
- `pk:error` is catalog-only with no emit or listener.
- Off-catalog events are invisible to shared-schema contract tests and are the highest drift risk.
- `docs/production/socket-inventory.csv` is stale and incomplete; its line numbers no longer match source.

### Authorization gaps

- `direct:typing:start` and `stop` check only ObjectId format (`api/services/socket.ts:294–302`). Any authenticated socket can spoof typing to any user ID; `direct:typing:update` inherits this. Verified in source.
- `pk:force_ended` fires on `input.force`, which bypasses the host/admin check at `api/services/pk.ts:610–615`. Verified in source.
- `emitRoom`, `emitUser` and `emitClanMembers` (`api/services/socket.ts:402–419`) perform no authorization; safety is entirely caller-dependent.
- Socket rate limiting silently drops over-limit packets without calling `next()` (`api/services/socket.ts:358,368`).
- Handshake auth requires access token, `sid`, `sub`, valid `User.tokenVersion`/`isBlocked` and an unrevoked `AuthSession` (`api/services/socket.ts:220–248`), but does not check suspension — an asymmetry with HTTP auth to reconcile.
- Admin emit authorization was not traced through `admin.ts` permission middleware; treat as an open verification item.

### Duplicate and out-of-order risks

- PK events share one `stateVersion` (`api/services/pk.ts:125`) but Android consumers do not filter on it (`a-core/YugmSocket.kt:91–95,119–142`). `lead:changed`, `score:update` and `timer:tick` can interleave.
- `clan:member:left` is emitted twice per action (`api/routes/clans.ts:612,613`).
- `direct:message:new` is emitted from four route files to both sides with no dedupe key.
- `sync:invalidate` has both private and public paths with 500ms coalescing (`api/services/socket.ts:30–39`).
- PK timers are disabled under `env.YUGM_RUNTIME === "cloudflare"` (`api/services/pk.ts:205,682,976,988`); deadline recovery depends on `runPkDeadlines()` (`:1025–1064`) or DO alarms.
- PK combo and reaction buckets (`api/services/pk.ts:46–47,792–795,878–885`) are process-local and cannot work across Workers.

### Parity tests required before protocol cutover

`room:join` ack payload (`socket.ts:268–282` versus `a-core/YugmSocket.kt:65–74`); `sync:invalidate` topic parity including `BONDS`; every off-catalog literal; PK invite/gift/score/end sequencing with persisted `stateVersion` and idempotency keys; wallet-debit-before-emit for `room:gift:send` and `pk:gift:received`; one-to-many `emitClanMembers`/`emitToParticipants` fan-out; the three dead voice-presence listeners; admin-only room events; and `recording:*`/watch-party events with no Android consumer. Add a two-client Android test and a load test; neither exists today.

## 8. Migration implications

- Do not treat ordinary WebSockets as interchangeable with Socket.IO. Handshake, rooms, acknowledgements, heartbeats, reconnection and Engine.IO sequencing must be reproduced or explicitly versioned.
- The experimental Worker bridge is non-hibernating with incomplete restart recovery; see [the Worker prototype audit](../infrastructure/worker-prototype-audit.md).
- Durable messages must be written to the authoritative database before ack. Ephemeral presence, typing and invalidation must never be treated as proof of commit.
- Private media URLs or content must never be delivered without ownership, conversation/room/clan membership, block/ban and privacy checks at delivery time.
- Raw audio/video stays with LiveKit, not these WebSockets.
- The inventory is a decision input only. No protocol is chosen and no code has been changed by this document.
