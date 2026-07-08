# Moderation Workflow

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
