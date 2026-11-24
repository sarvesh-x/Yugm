# D1 direct conversations and read state

The Android conversation screen continues to use `UserApi`. The shared D1 Worker now serves these existing contracts under `/api/users/messages`.

| Operation | D1 behavior |
| --- | --- |
| `GET /:userId` | Returns paginated messages, relationship progress and the viewer's mute setting. A latest-page request marks visible inbound messages read unless `markRead=false`. Loading older messages is passive. |
| `GET /:userId/search` | Returns a paginated literal substring search scoped to the conversation. SQLite's case-insensitive comparison covers ASCII. |
| `POST /:userId/read` and `POST /read-all` | Persist the viewer's read state for visible inbound messages. Replays return zero changed rows. |
| `PUT /:userId/mute` | Sets the viewer's preference without affecting the other participant. Concurrent updates do not create duplicate preferences. |
| `DELETE /:userId` | Hides the conversation for the requester. The other participant retains their message history. |

Conversation reads enforce account availability and block checks. A message-ID cursor is scoped to the same conversation and excludes messages hidden from the requester. Read mutations revalidate the session inside the write, and the latest-history read and read-state update run in one D1 batch. [D1 batch behavior](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

## Verification

- Both Worker integration suites and API/Worker typechecks passed. The D1 fixture covers history order and pagination, relationship details, search, hidden rows, concurrent receipts and mutes, both participants' visibility after a hide, and denial when blocked.
- The seven legacy direct-message characterization tests passed with disposable MongoDB.
- `0003_direct_message_indexes.sql` applied to the existing emulator database. All five indexes were present, and the existing user count remained one. The fixture's `EXPLAIN QUERY PLAN` used the unread index. Production index application remains pending. [D1 index verification](https://developers.cloudflare.com/d1/best-practices/use-indexes/#test-an-index)
- The loopback Worker reported `/ready` 200. Credential-free requests to conversation history and search reached the auth gate and returned 401.
- The audit reports 99 shared and 539 legacy-only patterns out of 638 legacy patterns. `git diff --check` passed.

The subsequent direct-message slice added text sends and replies. Attachment delivery and cross-device read or hide events remain open. This slice verifies persisted HTTP behavior with local fixtures. Live production and authenticated Android screen acceptance remain open. [D1 text send verification](2026-11-24-d1-direct-message-send.md) · [Legacy direct-message contract](2026-11-23-direct-message-baseline.md)
