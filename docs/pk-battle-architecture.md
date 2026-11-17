# PK battle architecture and implementation

## Repository audit

- Android uses Jetpack Compose feature modules; `feature:room` owns voice and livestream screens. `RoomViewModel`, `IYugmApi`/`YugmApi`, and `YugmSocket` connect room UI to API snapshots and Socket.IO. LiveKit provides existing room media.
- The API uses Express, TypeScript, Mongoose, MongoDB, and Socket.IO. Existing `Gift`, `GiftTransaction`, and wallet services remain the financial authority.
- Host/admin authorization comes from `Room.hostId` and `roomAdminIds`; mic and presence eligibility uses `RoomParticipant`.

## Decisions

1. Keep PK as one engine with separate `format` (PLAYER/TEAM/ROOM/LIVESTREAM) and `mode` (GIFT/VOTE/REACTION/MIXED) fields.
2. MongoDB is authoritative for battle state, roster, score, votes, gift transactions, and result. Socket.IO only projects committed changes.
3. Room reservations use `Room.activePkId`; same-room and cross-room creation reserve inside the creation transaction. Terminal flows release all matching reservations.
4. Gift debit, GiftTransaction, PK score, supporter leaderboard, and unique event sequence are committed in one transaction. PK points come from the server gift catalog and are separate from price/earnings.
5. Votes are one per authenticated room participant and enforced by a unique `(battleId, voterId)` index.
6. Server timestamps govern readiness countdown and battle deadlines. Delayed score writes are rejected at the database update boundary.
7. Finalization, result display, and closure are distinct. Host departure/room shutdown force-aborts and releases PK reservations.

## Current implementation

- Same-room Player PK and balanced Team PK support 2–5 contestants per side. Selected contestants must be active, unmuted speakers on mic seats. Readiness drives a server-coordinated countdown.
- Cross-room Gift and Vote invitations, opponent discovery, auto-match selection, mutual host acceptance, readiness, and video room support use the same battle state and event flow.
- Room UI exposes host/admin setup and management while all room users receive state, countdown, score, and result broadcasts. Gift/Vote support actions require authenticated room participation.
- PK history includes team participants, and per-battle supporter leaderboards are exposed. PK schema indexes are installed with production indexes.
- API route documentation is in `backend-server/apps/api/openapi.yaml`.

## Remaining scope

This implementation does not yet include persistent matchmaking tickets with mutual consent, profile/friend challenge entry points, team captain/substitution controls, readiness timeout and reconnect grace policies, overtime/tie-break rules, audited reward settlement, seasonal player/team rankings, push notification deep links, or replayable versioned Socket.IO streams. These need follow-up work before the system should be described as having those capabilities. The configured gift point migration is separate and requires a reviewed `--apply` run with the confirmation environment variable; no production data was changed here.
