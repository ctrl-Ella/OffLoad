import { PostgresStore } from "@mastra/pg";
import { env } from "@/lib/env";

/**
 * Mastra's store: the application's database, a different schema.
 * `schemaName: "mastra"` is the border. Without it Mastra would create its
 * tables in `public` and `prisma migrate` would treat them as undeclared
 * changes, proposing to drop them on every migration. Decision 0001.
 */
export const storage = new PostgresStore({
  id: "offload-store",
  connectionString: env.DATABASE_URL,
  schemaName: "mastra",
});
