# LiveKit production deployment

Yugm uses self-hosted **LiveKit OSS** for room/call media. Application signaling, room state, chat, and PK scoring stay on the API; only media transport uses LiveKit.

## Why not Cloudflare Workers for LiveKit

A LiveKit server needs a public IP, UDP media ports, and long-lived WebRTC sockets. **Cloudflare Workers cannot host it.** The production target is a hybrid: **Workers Free (API/D1/R2) + one always-on LiveKit host.**

## Cost model (honest)

LiveKit OSS has no license fee, but production is **not** $0:

- host (small VPS / Oracle Cloud Always Free ARM, or your own machine exposed safely),
- bandwidth egress (WebRTC-heavy; audio-only is cheap, video multiplies it),
- TURN relay, TLS certs, and your own operational time.

Self-hosted LiveKit has no per-minute/participant billing, which is the real advantage over a metered provider.

## Required configuration

Set these on the Worker as **secrets** (`wrangler secret put`), never as plaintext `vars`:

- `LIVEKIT_URL=wss://<livekit-host>` (must be `wss://` in production; `d1Api` requires it),
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (match `keys` in `livekit.yaml`; **not** `--dev` keys).

The production Worker currently ships `apps/cloudflare-worker/wrangler.production.jsonc` with **no `LIVEKIT_*` entries**, so media returns typed `503 ROOM_MEDIA_UNCONFIGURED` until secrets are added. Room chat still works.

## Server

Example config: [`backend-server/livekit/livekit.yaml.example`](../../backend-server/livekit/livekit.yaml.example).

Local dev uses `docker-compose.yml` (`livekit-server --dev`, `ws://localhost:7880`, `devkey`/`secret`); never point production at that.

## Media authorization model (this repo)

- Participant tokens are HS256, **2-hour TTL**, grants derived from current room state at issuance (`roomJoin`, `canPublish`, `canPublishSources`, `canSubscribe`, `name`). Access token `iss`=API key, `sub`=user id.
- `screen_share_audio` (room music) is granted to every non-`moderatorMuted` participant; the app lets any participant play music. There is no speaker-approval gate on music.
- **LiveKit cannot revoke an already-issued token.** Authoritative state is re-derived on mint, and the server now applies `RoomService.UpdateParticipant(can_publish=…)`, `RemoveParticipant`, and `DeleteRoom` for mute/kick/room-end. A muted/removed participant's already-connected session is addressed at the media layer, and Android re-mints + reconnects on `RoomEvent.Disconnected`.
- `POST /api/livekit/token` requires an authenticated, active (non-`left_at`), `LIVE`-room participant; `POST /api/pk/:battleId/media-sessions` requires `ACTIVE` video PK + room membership.
- **No LiveKit webhook consumer.** Presence truth is client-reported + a 2-day stale-room sweep; server-enforced publish + `DeleteRoom` reduce ghost-participant impact but don't fully reconcile. (Remaining gap.)

## Verification not run

Typechecks + repo tests pass. **Not verified against a live LiveKit server or two physical devices**: `UpdateParticipant` permission semantics, `DeleteRoom`/`RemoveParticipant` behavior, token `name`, Android reconnect-on-`Disconnected`, audio tuning, TURN reachability, or room music parity. Do not enable production media without that acceptance test.
