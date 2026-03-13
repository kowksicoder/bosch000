
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL && process.env.DATABASE_DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_DIRECT_URL;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });
