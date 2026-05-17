import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env, hasDatabaseConfig } from "@/lib/env";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!hasDatabaseConfig()) {
    return null;
  }

  if (!dbInstance) {
    const pool = new Pool({
      connectionString: env.databaseUrl
    });

    dbInstance = drizzle(pool);
  }

  return dbInstance;
}
