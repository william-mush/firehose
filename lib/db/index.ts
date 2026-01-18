import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { Sql } from "postgres";
import * as schema from "./schema";

// Cached instances for connection reuse
let client: Sql | null = null;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Get the database instance.
 * Creates a connection lazily on first use.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Create postgres connection
  // Using max 1 connection for serverless environments
  client = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Create drizzle instance
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

// For convenience, export a proxy that calls getDb() lazily
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

// Re-export schema for convenience
export * from "./schema";
