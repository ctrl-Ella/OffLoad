-- Runs once, when the data volume is created.
-- To re-run it: docker compose down -v (THIS DELETES THE DATA).

-- Needed by Mastra's semantic memory.
CREATE EXTENSION IF NOT EXISTS vector;

-- The border between the two halves of the database:
--   public -> the business domain, governed by Prisma's migrations
--   mastra -> threads, messages and traces, which Mastra manages on its own
-- Without the separation, `prisma migrate` reads Mastra's tables as drift and
-- tries to drop them on every migration.
CREATE SCHEMA IF NOT EXISTS mastra;
