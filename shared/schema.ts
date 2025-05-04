import { pgTable, text, serial, integer, timestamp, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users table (for authentication)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Employees table
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  position: text("position").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const employeesRelations = relations(employees, ({ many }) => ({
  timeEntries: many(timeEntries),
}));

export const employeeSchema = createInsertSchema(employees, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  email: (schema) => schema.email("Must provide a valid email"),
  position: (schema) => schema.min(2, "Position must be at least 2 characters"),
});

export type InsertEmployee = z.infer<typeof employeeSchema>;
export type Employee = typeof employees.$inferSelect & {
  lastCheckIn?: string;
};

// Time entries table
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  date: timestamp("date").notNull(),
  checkInTime: text("check_in_time").notNull(),
  checkOutTime: text("check_out_time"),
  breakMinutes: integer("break_minutes").default(0),
  totalHours: decimal("total_hours", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  employee: one(employees, {
    fields: [timeEntries.employeeId],
    references: [employees.id],
  }),
}));

export const timeEntrySchema = createInsertSchema(timeEntries, {
  employeeId: (schema) => schema.min(1, "Employee ID is required"),
  date: (schema) => z.preprocess(
    (val) => {
      // Handle Date objects or ISO strings
      if (val instanceof Date) return val;
      if (typeof val === 'string') return new Date(val);
      return val;
    },
    schema
  ),
  checkInTime: (schema) => schema.min(1, "Check-in time is required"),
  breakMinutes: (schema) => schema.default(0),
});

export type InsertTimeEntry = z.infer<typeof timeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect & {
  employeeName?: string;
};

// Create schemas for validation
export const timeEntrySelectSchema = createSelectSchema(timeEntries);
export const employeeSelectSchema = createSelectSchema(employees);

// Report types
export type ReportFilters = {
  reportType: string;
  dateFrom?: Date;
  dateTo?: Date;
  employeeId?: number;
};

export type TimeEntriesFilter = {
  dateFrom?: Date;
  dateTo?: Date;
  employeeId?: number;
  page: number;
  pageSize: number;
};

export type DashboardStats = {
  totalHours: number;
  activeEmployees: number;
  checkedInCount: number;
  avgHoursPerEmployee: number;
  weeklyAvgHours: number;
};
