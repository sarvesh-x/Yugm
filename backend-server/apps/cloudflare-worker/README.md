# Cloudflare Worker

`yugm-api-production` is the hosted API. It binds the hosted `yugm` D1 database and the five R2 buckets. The Android debug app connects to `npm run dev` on port 4000 with local D1 and R2. The GitHub workflow deploys the hosted Worker on backend changes to `master` or when dispatched manually. The production Pages project deploys independently.

From `backend-server`:

```sh
npm ci
npm run dev
npm run test:d1-worker
```

Android connects to `/realtime` using a bearer access token over WebSocket. The Worker assigns a private user channel, or authorizes a room channel when the signed-in user is an active member of that live room. Use `/ready` to verify storage readiness before testing a connection. The local address from the emulator is `http://10.0.2.2:4000`.

Configure the `cloudflare-production` GitHub environment with `CLOUDFLARE_ACCOUNT_ID` and the `CLOUDFLARE_API_TOKEN` secret. Once the Worker has a public production hostname and its Firebase and signing credentials, set `YUGM_PRODUCTION_ORIGIN` to the same HTTPS origin for workflow readiness checks and Android release configuration. [Production setup](../../../docs/handoffs/2026-11-26-production-d1-r2.md)
