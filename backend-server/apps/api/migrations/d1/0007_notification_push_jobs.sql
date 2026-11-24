CREATE TABLE notification_push_jobs (
  notification_id TEXT NOT NULL REFERENCES notifications(source_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_id TEXT,
  due_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (notification_id, device_id)
);

CREATE INDEX idx_notification_push_ready ON notification_push_jobs (due_at, notification_id, device_id) WHERE status = 'PENDING';
CREATE INDEX idx_notification_push_lease ON notification_push_jobs (lease_id) WHERE lease_id IS NOT NULL;
CREATE INDEX idx_notification_push_expiry ON notification_push_jobs (expires_at);
CREATE INDEX idx_device_tokens_owner ON device_tokens (user_id, source_id);

-- An inbox record and its pending deliveries commit together. Existing rows are not replayed.
CREATE TRIGGER enqueue_notification_push AFTER INSERT ON notifications
WHEN NEW.read = 0 AND NEW.created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')
BEGIN
  INSERT INTO notification_push_jobs (notification_id, device_id, due_at, expires_at)
    SELECT NEW.source_id, source_id, NEW.created_at, strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at, '+1 day')
    FROM device_tokens WHERE user_id = NEW.user_id;
END;
