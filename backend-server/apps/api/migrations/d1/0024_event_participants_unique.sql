CREATE UNIQUE INDEX IF NOT EXISTS "idx_event_participants_event_user" ON "event_participants" ("events_id", "value");
CREATE INDEX IF NOT EXISTS "idx_event_participants_user" ON "event_participants" ("value", "events_id");
