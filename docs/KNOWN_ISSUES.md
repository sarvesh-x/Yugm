# Known issues and verification limits

The detailed, prioritized register is [production/findings.md](production/findings.md); statuses after the original audit are summarized in [production/current-progress.md](production/current-progress.md). The following are still high-priority evidence areas from that record and must be checked against current source:

- Durable, account-scoped message command identity and reconnect/process-death recovery.
- Socket session revocation and authorization parity for ephemeral events.
- Authoritative call lifecycle and private-video permissions.
- Financial workflow recovery, replay scope, and reconciliation beyond covered paths.
- Event privacy/invitation/lifecycle and durable notification delivery.
- Android account-switch safety, notification dedupe, and device lifecycle verification.
- Production datastore topology, live indexes/data quality, backup/restore, provider sandbox, and deployed configuration are not established by source inspection.

Do not present these as confirmed current defects unless rechecked against the current working tree. The finding register separates source evidence from proposed tests and production-state unknowns.
