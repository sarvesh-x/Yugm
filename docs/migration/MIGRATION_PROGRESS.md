# Migration progress by preservation gate

The [root tracker](../../MIGRATION_PROGRESS.md) remains the work log. The [active 18-phase plan](implementation-plan.md#phase-gates) defines each gate. This index records the current acceptance boundary.

**Active journey.** Profile. The loopback D1 read and edit routes passed. Next, verify Android setup and Edit Profile against that Worker. Settings, chat and rooms follow in that order. [Profile edit evidence](../handoffs/2026-11-24-d1-profile-edits.md) · [Journey sequence](implementation-plan.md#journey-order)

| Gate range | Evidence and status |
| --- | --- |
| 0. Source baseline | Initial registries and refreshed static indexes are available. Review unresolved mounts, behaviors and provider details for each affected slice. |
| 1. Characterization | Auth fixtures cover Firebase email, Google, Facebook and phone exchanges, account linking, refresh rotation, logout and App Check with a stubbed provider. Android startup-routing and App Check policy JVM tests passed. Live Firebase and device parity remain open. [Auth handoff](../handoffs/2026-11-23-auth-providers-and-session-mapping.md) |
| 2–5. Adapters, D1, data and Worker | The local Auth router matched the MongoDB fixture for identity linkage, complete self-profile, refresh and scoped logout. The loopback Worker passed the D1 Auth lifecycle with generated Firebase keys and no MongoDB or Redis connection. Staging wiring and data rehearsal remain open. Arcade score writes are deferred. [Auth journey handoff](../handoffs/2026-11-24-auth-journey-parity.md) · [Local Worker evidence](../handoffs/2026-11-24-local-d1-auth-worker.md) |
| 6–11. Firebase, media, Redis, realtime, RTC and jobs | Preserve Firebase and FCM. The [local push Queues slice](../handoffs/2026-11-23-local-push-queues.md) verifies the notification contract and durable recovery against controlled provider results. Staging FCM/device parity, job drain, live media authorization, Redis replacements, both-path realtime and RTC device parity remain open. |
| 12–14. Financial, admin and journeys | Android 17 passed the local Navigation checks. The local Worker serves Profile reads and edits on D1, with one-time completion XP and atomic level-up wallet effects in the fixture. The device edit journey, live invalidation, presence and managed-avatar parity remain open. [Full-app Navigation evidence](../handoffs/2026-11-24-navigation-process-restart.md) · [Profile edit evidence](../handoffs/2026-11-24-d1-profile-edits.md) |
| 15–17. Cutover, cleanup and acceptance | Blocked for production by capacity, recovery, runtime parity and outstanding authorizations. MongoDB remains authoritative. No legacy dependency has been retired in this pass. |

Use the [system inventory](EXISTING_SYSTEM_INVENTORY.md), [model registry](MODEL_CONTRACT_REGISTRY.md), [business registry](BUSINESS_RULE_REGISTRY.md), [user flow registry](USER_FLOW_REGISTRY.md), [API registry](API_CONTRACT_REGISTRY.md), [event registry](EVENT_CONTRACT_REGISTRY.md) and [dependency map](DEPENDENCY_MAP.md) before implementing an affected slice.
