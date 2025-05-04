import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { employeeSchema, timeEntrySchema } from "@shared/schema";
import { isWeekend, parseISO, format, startOfDay, endOfDay, addHours } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Dashboard API endpoint
  app.get("/api/dashboard", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const dateParam = req.query.date as string || new Date().toISOString().split("T")[0];
      const date = parseISO(dateParam);
      
      const entries = await storage.getTimeEntriesByDate(date);
      const stats = await storage.getDashboardStats(date);

      res.json({
        entries,
        stats,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Employees API endpoints
  app.get("/api/employees", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const employees = await storage.getAllEmployees();
      res.json(employees);
    } catch (error) {
      console.error("Fetch employees error:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const validatedData = employeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Create employee error:", error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const id = parseInt(req.params.id);
      const employee = await storage.getEmployeeById(id);
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error) {
      console.error("Fetch employee error:", error);
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  app.patch("/api/employees/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const id = parseInt(req.params.id);
      const validatedData = employeeSchema.partial().parse(req.body);
      
      const employee = await storage.updateEmployee(id, validatedData);
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Update employee error:", error);
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.patch("/api/employees/:id/deactivate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const id = parseInt(req.params.id);
      const employee = await storage.updateEmployee(id, { status: "inactive" });
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error) {
      console.error("Deactivate employee error:", error);
      res.status(500).json({ error: "Failed to deactivate employee" });
    }
  });

  // Time Entries API endpoints
  app.get("/api/time-entries", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const dateFrom = req.query.dateFrom ? parseISO(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? parseISO(req.query.dateTo as string) : undefined;
      const employeeId = req.query.employeeId && req.query.employeeId !== "all_employees" 
        ? parseInt(req.query.employeeId as string) 
        : undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = 10;
      
      const result = await storage.getTimeEntries({
        dateFrom,
        dateTo,
        employeeId,
        page,
        pageSize,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Fetch time entries error:", error);
      res.status(500).json({ error: "Failed to fetch time entries" });
    }
  });

  app.post("/api/time-entries", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const data = req.body;
      
      // Skip Zod validation and explicitly process the data
      let dateObj: Date;
      
      if (typeof data.date === 'string') {
        dateObj = new Date(data.date);
      } else if (data.date instanceof Date) {
        dateObj = data.date;
      } else {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      // Validate the date
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
      
      // Check if it's a weekend
      if (isWeekend(dateObj)) {
        return res.status(400).json({ error: "Cannot add time entries for weekends" });
      }
      
      // Create a clean object with all the necessary conversions
      const processedData = {
        employeeId: Number(data.employeeId),
        date: dateObj,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime || undefined,
        breakMinutes: Number(data.breakMinutes) || 0
      };
      
      console.log("Processed data for time entry:", processedData);
      
      // Skip the schema validation and pass directly to storage
      const timeEntry = await storage.createTimeEntry(processedData);
      
      res.status(201).json(timeEntry);
    } catch (error: any) {
      console.error("Create time entry error:", error);
      res.status(500).json({ error: error.message || "Failed to create time entry" });
    }
  });

  app.get("/api/time-entries/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const id = parseInt(req.params.id);
      const timeEntry = await storage.getTimeEntryById(id);
      
      if (!timeEntry) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      
      res.json(timeEntry);
    } catch (error) {
      console.error("Fetch time entry error:", error);
      res.status(500).json({ error: "Failed to fetch time entry" });
    }
  });

  app.patch("/api/time-entries/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const id = parseInt(req.params.id);
      const data = req.body;
      
      // Create an object to hold the processed data
      const processedData: any = {};
      
      // Process each field individually
      if (data.employeeId !== undefined) {
        processedData.employeeId = Number(data.employeeId);
      }
      
      if (data.breakMinutes !== undefined) {
        processedData.breakMinutes = Number(data.breakMinutes);
      }
      
      if (data.checkInTime !== undefined) {
        processedData.checkInTime = data.checkInTime;
      }
      
      if (data.checkOutTime !== undefined) {
        processedData.checkOutTime = data.checkOutTime || undefined;
      }
      
      // Handle date field
      if (data.date !== undefined) {
        let dateObj: Date;
        
        if (typeof data.date === 'string') {
          dateObj = new Date(data.date);
        } else if (data.date instanceof Date) {
          dateObj = data.date;
        } else {
          return res.status(400).json({ error: "Invalid date format" });
        }
        
        // Validate the date
        if (isNaN(dateObj.getTime())) {
          return res.status(400).json({ error: "Invalid date" });
        }
        
        // Check if it's a weekend
        if (isWeekend(dateObj)) {
          return res.status(400).json({ error: "Cannot update time entries to weekends" });
        }
        
        processedData.date = dateObj;
      }
      
      console.log("Processed data for time entry update:", processedData);
      
      const timeEntry = await storage.updateTimeEntry(id, processedData);
      
      if (!timeEntry) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      
      res.json(timeEntry);
    } catch (error: any) {
      console.error("Update time entry error:", error);
      res.status(500).json({ error: error.message || "Failed to update time entry" });
    }
  });

  app.delete("/api/time-entries/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const id = parseInt(req.params.id);
      await storage.deleteTimeEntry(id);
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete time entry error:", error);
      res.status(500).json({ error: "Failed to delete time entry" });
    }
  });

  app.post("/api/time-entries/:id/checkout", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const id = parseInt(req.params.id);
      const timeEntry = await storage.checkoutTimeEntry(id);
      
      if (!timeEntry) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      
      res.json(timeEntry);
    } catch (error) {
      console.error("Checkout time entry error:", error);
      res.status(500).json({ error: "Failed to checkout time entry" });
    }
  });

  // Reports API endpoints
  app.get("/api/reports", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const reportType = req.query.reportType as string || "weekly";
      const dateFrom = req.query.dateFrom ? parseISO(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? parseISO(req.query.dateTo as string) : undefined;
      const employeeId = req.query.employeeId && req.query.employeeId !== "all_employees" 
        ? parseInt(req.query.employeeId as string) 
        : undefined;
      
      const report = await storage.generateReport({
        reportType,
        dateFrom,
        dateTo,
        employeeId,
      });
      
      res.json(report);
    } catch (error) {
      console.error("Generate report error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
