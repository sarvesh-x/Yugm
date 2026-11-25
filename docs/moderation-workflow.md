# Moderation Workflow

The shared D1 Worker creates queue entries at report intake. Staff with `reports.read` can read the evidence through the D1 report routes. Submission responses return a receipt with no evidence. Manual moderator actions below still use the legacy runtime. [D1 report workflow](handoffs/2026-11-25-d1-reports-and-gift-catalog.md)

1. A user report is created by the app.
2. Admin report listing/detail access ensures a matching `ModerationQueue` item exists.
3. A moderator assigns, escalates, dismisses, resolves, or acts on the report.
4. Admin actions create `AdminModerationAction` and `AdminAuditLog` records.
5. Target user safety is recalculated in `UserSafetyStatus`.

Supported report actions:

- `NO_ACTION`
- `WARNING`
- `DELETE_MESSAGE`
- `HIDE_PROFILE`
- `REMOVE_PHOTO`
- `SUSPEND_USER`
- `BAN_USER`
- `END_ROOM`
- `ESCALATE`

Private chat access requires `messages.read_private` and is audit-logged.

Live room controls emit Socket.IO admin events and update room/user state where applicable.
