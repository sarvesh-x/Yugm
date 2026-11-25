CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_moods_user" ON "user_moods" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_questions_date" ON "daily_questions" ("date");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_daily_answers_user_question"
  ON "user_daily_answers" ("user_id", "question_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_voice_poll_votes_poll_value"
  ON "voice_poll_votes" ("voice_polls_id", "value") WHERE "value" IS NOT NULL;
ALTER TABLE "user_moods" ADD COLUMN "activity_room_id_present" INTEGER NOT NULL DEFAULT 0;
