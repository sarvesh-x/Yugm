# D1 immersive themes and public pages

The debug and production Worker entrypoints share these D1 mounts.

| Method and path | Behavior |
| --- | --- |
| `GET /api/themes` | Lists available themes. The first authenticated catalog request inserts the 18 existing defaults when the catalog is empty. |
| `POST /api/themes/purchase` | Adds the entitlement and charges coins atomically. A repeat purchase returns the theme without charging again. |
| `GET /api/user/themes` | Returns owned themes and the room, profile and entrance slots. |
| `POST /api/user/themes/equip` | Equips an available free or owned theme and accepts null to clear a slot. |
| `POST /api/rooms/:id/theme` | Applies a free or owned theme for the host, co-host or platform admin. |
| `GET /` and `GET /legal/{privacy,terms,child-safety,account-deletion,contact}` | Serve the existing service response and public pages. The two forms post to `/api/support/public-requests`. |

The first catalog request seeds only an empty `immersive_themes` table. Imported or operator-managed rows are preserved, including a catalog deliberately marked unavailable. The routes use the existing schema and require no new migration. Carry existing theme rows and owned keys through the planned data import before accepting production traffic.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both Worker fixtures. The local fixture checked catalog seeding under concurrent reads, authorization, concurrent purchase and rollback, insufficient funds, free and paid entitlement, equip and clear, co-host room control, HTML delivery and the public support intake.
- The `typecheck` scripts passed for both the API and Cloudflare Worker workspaces.
- `npm run audit:d1-endpoints` counted 638 legacy routes, 199 D1 routes, 194 shared patterns and 444 legacy-only patterns. The audit counts mounts. It includes 18 remaining room routes and 204 remaining admin routes.
- The running debug Worker on port 4000 returned HTTP 200 for readiness and the account-deletion page and HTTP 401 for an anonymous theme catalog request.

Hosted deployment, hosted end-to-end verification and Android UI testing remain open. The remaining route and data cutover work still gates MongoDB retirement.
