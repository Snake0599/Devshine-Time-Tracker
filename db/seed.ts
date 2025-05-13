import { db } from "./index.ts";
import * as schema from "../shared/schema.ts";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { sql } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  try {
    console.log("Seeding database...");

    // Seed admin user
    const existingAdminUser = await db.query.users.findFirst({
      where: sql`username = 'abdullah.devshine@gmail.com'`
    });

    if (!existingAdminUser) {
      console.log("Creating admin user...");
      await db.insert(schema.users).values({
        username: "abdullah.devshine@gmail.com",
        password: await hashPassword("devshine123"),
      });
      console.log("Admin user created!");
    } else {
      console.log("Admin user already exists, skipping...");
    }

    // Seed sample employees if none exist
    const employeesCount = await db
      .select({ count: sql`count(*)` })
      .from(schema.employees);
    
    if (Number(employeesCount[0].count) === 0) {
      console.log("Creating sample employees...");
      
      const sampleEmployees = [
        {
          name: "John Smith",
          email: "john.smith@example.com",
          position: "Senior Developer",
          status: "active",
        },
        {
          name: "Jane Doe",
          email: "jane.doe@example.com",
          position: "UX Designer",
          status: "active",
        },
        {
          name: "Michael Johnson",
          email: "michael.johnson@example.com",
          position: "QA Engineer",
          status: "active",
        },
        {
          name: "Emily Wilson",
          email: "emily.wilson@example.com",
          position: "Project Manager",
          status: "active",
        },
        {
          name: "Robert Brown",
          email: "robert.brown@example.com",
          position: "DevOps Engineer",
          status: "active",
        },
      ];
      
      await db.insert(schema.employees).values(sampleEmployees);
      console.log("Sample employees created!");
    } else {
      console.log("Employees already exist, skipping...");
    }

    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
