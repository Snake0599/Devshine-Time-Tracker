import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./db/migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: "aws-0-ap-south-1.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: "postgres.stvovoxmvrhgkszesngt",
    password: "Snake0599",
    ssl: {
      rejectUnauthorized: false, // <- allows self-signed certs
    },
  },
});
