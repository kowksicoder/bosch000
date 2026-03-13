import { config } from 'dotenv';
import { defineConfig } from "drizzle-kit";

// Load environment variables from .env file
config();

// Use direct connection for migrations (DATABASE_DIRECT_URL)
// Use pooler connection for runtime queries (DATABASE_URL)
const databaseUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL || process.env.REPLIT_DB_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL not found. Please add PostgreSQL from the Tools panel or set DATABASE_URL in Secrets.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
