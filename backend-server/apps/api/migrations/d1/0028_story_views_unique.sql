CREATE UNIQUE INDEX IF NOT EXISTS "idx_story_views_story_value"
  ON "story_views" ("stories_id", "value") WHERE "value" IS NOT NULL;
