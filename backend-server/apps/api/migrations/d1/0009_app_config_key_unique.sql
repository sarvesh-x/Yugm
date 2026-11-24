-- AppConfig.key is unique in the source Mongoose schema.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_config_key" ON "app_config" ("key");
