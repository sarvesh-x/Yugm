# Public room entry and video call wiring

Implemented on 2026-11-17 against the current repository baseline.

## Behavior

- Party voice and video cards allow entry regardless of RoomFollow. Follow remains a separate favorites action. Existing private invitation, VIP, moderation and blocked-user checks still apply.
- Viewers enter a video room as audience without publishing their camera or microphone. The participant roster and header count use active membership. Tapping the video room cover or member count opens its roster.
- Viewers request to join the call. The host sees a request count and an accept/decline queue. Approval grants the speaker microphone and camera token sources; Android obtains device permissions and reconnects with the approved token. Rejection clears the pending state and permits a new request. Leaving clears pending requests.
- Video audience cannot bypass approval through the voice take-seat route. Muted guests cannot receive camera or microphone publishing grants in a new token.
- Active guest video appears alongside the host. Video renderers recreate for replacement tracks after media reconnect. Guests have camera and microphone controls.
- Realtime event bursts retain roster/request refreshes even when an activity event arrives afterward. The existing five-second video detail refresh provides fallback recovery.

## Verification

- API TypeScript check passed.
- Backend unit suite: 151 passed.
- Isolated MongoDB integration suite: 25 passed. New route coverage verifies unfollowed voice/video entry, repeat entry without count inflation, active roster/count changes on leave/rejoin, viewer token restrictions, host-only accept/decline, approved guest media grants, muted token restrictions, re-entry after permission, rejection/retry, pending-request cleanup on leave, and token denial after leaving.
- Android app Kotlin compilation and existing room socket lifecycle unit tests passed. The integration suite stubs media token issuance; it exercises real HTTP/auth/database routes, not a LiveKit server.

## Deployment and remaining live checks

The Android changes and backend camera grant change must both be deployed for approved guest video. No production deployment or APK release was performed.

Real host/viewer devices and a configured LiveKit service are still required to verify actual camera/audio transport, permission denial/recovery, switching cameras, background/resume, network reconnection and PK interaction. Existing tokens are not actively revoked by this change when moderation state changes; server-side LiveKit permission revocation remains a separate production-hardening requirement. This is not full app launch certification.
