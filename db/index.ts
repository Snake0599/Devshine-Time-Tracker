import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg"; // <-- default import
import * as schema from "../shared/schema.ts";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // For Supabase
  },
});

export const db = drizzle(pool, { schema });
