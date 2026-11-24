# D1 direct text messages and replies

`POST /api/users/messages/:userId` now accepts plain text and replies to visible messages in the conversation. It validates the sender's session, mute and chat restrictions, both block directions, recipient availability, and the follower-only setting with the existing VIP exception. Managed chat attachments still need an R2 upload and access flow. The send endpoint returns HTTP 415 for a supplied attachment URL until that flow is available.

The write rechecks authorization and progression state in D1. It commits the message, the sender's inbound read state, the recipient's inbox notice when the conversation is unmuted, and eligible user XP, Battle Pass XP, and pair XP together. Daily caps are 100 user XP and 120 relationship XP for chat. Repeated sends produce separate messages. An eligible low or medium moderation flag increments warnings, and a send that triggers a chat restriction is denied. Weekly streak notices are recorded when the pair reaches the milestone. [D1 transaction semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

The local and production bindings configure `CHAT_SEND` for 12 attempts per authenticated sender per 10 seconds per location. The binding counters are approximate. The D1 XP accounting remains authoritative across requests. [Cloudflare rate-limit behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

## Verification

- Both Worker fixtures passed with `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs`. The local fixture exercises anonymous and denied requests, follower-only privacy, concurrent identical sends, reply visibility, inbox mutes, moderation, XP caps, rate limiting, and whole-batch rollback after an injected inbox failure. The production fixture checks the shared runtime and production configuration in isolation.
- Both `npm run typecheck --workspace @yugm/cloudflare-worker` and `npm run typecheck --workspace @yugm/api` passed. All seven legacy `directMessages.characterization.test.ts` tests passed with disposable MongoDB and Redis disabled.
- `npm run d1:setup:local` applied `0004_direct_message_writes.sql` to local `yugm`. Wrangler's local migration list showed zero pending migrations. The restarted debug Worker returned `/ready` HTTP 200 and an anonymous send returned HTTP 401 from both the host and Android emulator. `git diff --check` passed.
- `npm run audit:d1-endpoints` reports 100 shared and 538 legacy-only routes out of 638 legacy patterns. This is a count of mounted methods and paths.

Hosted `yugm` was previously verified through `0002` and still needs `0003` and `0004` for the updated Worker. Live production, authenticated Android, attachment delivery, realtime events and FCM remain open. The D1 inbox records are available over HTTP.
