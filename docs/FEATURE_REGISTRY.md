# Feature registry (initial source inventory)

Statuses use the project vocabulary: Planned, Partially implemented, Implemented but unverified, Broken, Verified working, Deprecated. This initial inventory avoids claiming end-to-end status from file presence. Source inspection and runtime verification are not interchangeable.

| Feature area | Android source | Backend source | Initial status / evidence |
|---|---|---|---|
| Authentication and profiles | `feature/auth`, `feature/profile`, `core/data` | `routes/auth.ts`, `routes/users.ts`, user/session models and auth services | P0/P1 reliability fixes implemented; 5 auth unit tests, 167 API tests, API typecheck, and 3 emulator regressions passed. Firebase provider and live Mongo journeys remain unverified; see [auth flow audit](features/auth-flow-audit.md) |
| First-launch splash and onboarding | `feature/auth/screens/SplashScreen.kt`, `OnboardingScreen.kt`, `feature/auth/navigation/AuthNavGraph.kt` | None in this client-side intro path | Implemented; signed-out cold starts replay onboarding by design; see [onboarding audit](features/onboarding-audit.md) for TalkBack/system-splash verification limits and [auth flow audit](features/auth-flow-audit.md) for validated startup routing |
| Discovery and rooms | `feature/discover`, `feature/room`, `feature/room-modes` | `routes/discover.ts`, `routes/rooms.ts`, room models/services and Socket.IO | Partially implemented; lifecycle/realtime proof gaps in audit |
| Direct and clan chat | `feature/chat` | `routes/users.ts`, `routes/groups.ts`, message models and socket handlers | Partially implemented; durable send identity and reconnect recovery remain audit priorities |
| Social, friends, bonds, dating | `feature/social`, `feature/profile` | `routes/friends.ts`, `routes/social.ts`, `routes/bonds.ts`, `routes/dating.ts` | Implemented but unverified; validate each contract and user journey before status upgrade |
| Wallet, purchases, gifts, payouts | `feature/wallet`, `feature/gift` | `routes/wallet.ts`, gift/purchase/wallet/payout services and models | Partially implemented; financial behavior and verification gates in wallet/payout docs and progress report |
| Events, missions, progression | `feature/events`, `feature/missions` | corresponding routes, services, and models | Partially implemented; see current progress for event fixes and remaining delivery policy |
| Creator tools | `feature/creator` | `routes/creator.ts` and payout/KYC services | Implemented but unverified; see payout KYC documentation |
| Safety and moderation | `feature/moderation` | moderation/report/admin routes and services | Implemented but unverified end to end; see moderation and permission docs |
| Admin console | `backend-server/apps/admin` | `/api/admin/*` routes and admin auth | Implemented but unverified; see `admin-system.md` |
| Cloudflare migration | Worker scaffold under `backend-server/apps/cloudflare-worker` | Worker compatibility layer | Partially implemented; explicitly not production ready per migration audit |

For verified endpoint and data-field inventories see [HTTP](production/endpoint-inventory.csv), [Socket.IO](production/socket-inventory.csv), and [schema](production/schema-inventory.csv) inventories. Feature IDs, precise per-client status, dependencies, and tests should be added when each area receives a focused audit; do not infer these from route/file counts.
