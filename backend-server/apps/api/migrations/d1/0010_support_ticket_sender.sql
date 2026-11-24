-- Legacy admin replies put an admin ID into SupportTicket.messages.senderId even though
-- the generated table constrained that column to users. Split the two sender kinds so
-- admin responses can be stored without an invalid user foreign key.
CREATE TABLE "support_ticket_messages_v2" (
  source_id TEXT PRIMARY KEY,
  "sender_id" TEXT REFERENCES "users"("source_id"),
  "sender_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "sender_role" TEXT NOT NULL CHECK ("sender_role" IN ('USER', 'ADMIN')),
  "message" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "support_tickets_id" TEXT NOT NULL REFERENCES "support_tickets"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0),
  CHECK ((sender_role = 'ADMIN' AND sender_admin_id IS NOT NULL)
      OR (sender_role = 'USER' AND sender_id IS NOT NULL))
);

INSERT INTO "support_ticket_messages_v2"
  (source_id, sender_id, sender_admin_id, sender_role, message, created_at, support_tickets_id, position)
SELECT source_id,
  CASE WHEN sender_role = 'ADMIN' THEN NULL ELSE sender_id END,
  CASE WHEN sender_role = 'ADMIN' THEN sender_id ELSE NULL END,
  sender_role, message, created_at, support_tickets_id, position
FROM "support_ticket_messages";

DROP TABLE "support_ticket_messages";
ALTER TABLE "support_ticket_messages_v2" RENAME TO "support_ticket_messages";
CREATE INDEX IF NOT EXISTS "idx_support_ticket_messages_parent" ON "support_ticket_messages" ("support_tickets_id", position);
