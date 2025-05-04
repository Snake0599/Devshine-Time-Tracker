import { db } from "@db";
import { Pool } from "@neondatabase/serverless";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { eq, and, between, gte, lte, desc, sql, getTableColumns } from "drizzle-orm";
import { 
  users, 
  employees, 
  timeEntries, 
  insertUserSchema, 
  User, 
  InsertUser,
  Employee,
  InsertEmployee,
  TimeEntry,
  InsertTimeEntry,
  TimeEntriesFilter,
  ReportFilters,
  DashboardStats 
} from "@shared/schema";
import { 
  format, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek,
  subDays,
  addDays,
  differenceInCalendarDays,
  isWeekend,
  endOfMonth,
  startOfMonth,
  formatISO 
} from "date-fns";
import { calculateTotalHours, formatTime } from "@shared/utils";

export interface IStorage {
  // User methods
  createUser: (user: InsertUser) => Promise<User>;
  getUser: (id: number) => Promise<User>;
  getUserByUsername: (username: string) => Promise<User | undefined>;

  // Employee methods
  createEmployee: (employee: InsertEmployee) => Promise<Employee>;
  getAllEmployees: () => Promise<Employee[]>;
  getEmployeeById: (id: number) => Promise<Employee | undefined>;
  updateEmployee: (id: number, data: Partial<InsertEmployee>) => Promise<Employee | undefined>;

  // Time entries methods
  createTimeEntry: (timeEntry: InsertTimeEntry) => Promise<TimeEntry>;
  getTimeEntriesByDate: (date: Date) => Promise<TimeEntry[]>;
  getTimeEntries: (filters: TimeEntriesFilter) => Promise<{
    entries: TimeEntry[];
    totalEntries: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    startIndex: number;
    endIndex: number;
  }>;
  getTimeEntryById: (id: number) => Promise<TimeEntry | undefined>;
  updateTimeEntry: (id: number, data: Partial<InsertTimeEntry>) => Promise<TimeEntry | undefined>;
  deleteTimeEntry: (id: number) => Promise<void>;
  checkoutTimeEntry: (id: number) => Promise<TimeEntry | undefined>;

  // Report methods
  generateReport: (filters: ReportFilters) => Promise<any>;
  
  // Dashboard methods
  getDashboardStats: (date: Date) => Promise<DashboardStats>;
  
  // Session store
  sessionStore: session.Store;
}

// Configure the session store
const PostgresSessionStore = connectPg(session);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User methods
  async createUser(userData: InsertUser): Promise<User> {
    const validatedData = insertUserSchema.parse(userData);
    const [user] = await db.insert(users).values(validatedData).returning();
    return user;
  }

  async getUser(id: number): Promise<User> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) throw new Error("User not found");
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: eq(users.username, username),
    });
  }

  // Employee methods
  async createEmployee(employeeData: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values({
      ...employeeData,
      status: "active",
    }).returning();
    return employee;
  }

  async getAllEmployees(): Promise<Employee[]> {
    // Get all employees with their most recent check-in
    const result = await db.query.employees.findMany({
      orderBy: [desc(employees.name)],
    });

    const employeesWithLastCheckIn = await Promise.all(
      result.map(async (employee) => {
        // Get the most recent time entry for this employee
        const latestEntry = await db.query.timeEntries.findFirst({
          where: eq(timeEntries.employeeId, employee.id),
          orderBy: [desc(timeEntries.date), desc(timeEntries.createdAt)],
        });

        return {
          ...employee,
          lastCheckIn: latestEntry ? latestEntry.date.toISOString() : undefined,
        };
      })
    );

    return employeesWithLastCheckIn;
  }

  async getEmployeeById(id: number): Promise<Employee | undefined> {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, id),
    });

    if (!employee) return undefined;

    // Get the most recent time entry for this employee
    const latestEntry = await db.query.timeEntries.findFirst({
      where: eq(timeEntries.employeeId, employee.id),
      orderBy: [desc(timeEntries.date), desc(timeEntries.createdAt)],
    });

    return {
      ...employee,
      lastCheckIn: latestEntry ? latestEntry.date.toISOString() : undefined,
    };
  }

  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [employee] = await db.update(employees)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();

    if (!employee) return undefined;

    // Get the most recent time entry for this employee
    const latestEntry = await db.query.timeEntries.findFirst({
      where: eq(timeEntries.employeeId, employee.id),
      orderBy: [desc(timeEntries.date), desc(timeEntries.createdAt)],
    });

    return {
      ...employee,
      lastCheckIn: latestEntry ? latestEntry.date.toISOString() : undefined,
    };
  }

  // Time entries methods
  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    // Calculate total hours if check-out time is provided
    let totalHoursValue = null;
    if (data.checkOutTime) {
      const hours = calculateTotalHours(
        data.checkInTime,
        data.checkOutTime,
        data.breakMinutes || 0
      );
      
      totalHoursValue = hours !== null ? hours : null;
    }

    // Format the time values to 12-hour format
    const formattedCheckInTime = formatTime(data.checkInTime);
    const formattedCheckOutTime = data.checkOutTime ? formatTime(data.checkOutTime) : undefined;

    // Insert the time entry
    const [timeEntry] = await db.insert(timeEntries).values({
      ...data,
      checkInTime: formattedCheckInTime,
      checkOutTime: formattedCheckOutTime,
      totalHours: totalHoursValue,
    }).returning();

    // Get employee name
    const employee = await this.getEmployeeById(timeEntry.employeeId);

    return {
      ...timeEntry,
      employeeName: employee?.name,
    };
  }

  async getTimeEntriesByDate(date: Date): Promise<TimeEntry[]> {
    const startOfTheDay = startOfDay(date);
    const endOfTheDay = endOfDay(date);

    const entries = await db.query.timeEntries.findMany({
      where: between(timeEntries.date, startOfTheDay, endOfTheDay),
      orderBy: [desc(timeEntries.createdAt)],
    });

    // Get employee names
    const entriesWithEmployeeNames = await Promise.all(
      entries.map(async (entry) => {
        const employee = await this.getEmployeeById(entry.employeeId);
        return {
          ...entry,
          employeeName: employee?.name,
        };
      })
    );

    return entriesWithEmployeeNames;
  }

  async getTimeEntries(filters: TimeEntriesFilter): Promise<{
    entries: TimeEntry[];
    totalEntries: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    startIndex: number;
    endIndex: number;
  }> {
    const { dateFrom, dateTo, employeeId, page, pageSize } = filters;
    
    // Build the where clause
    let whereClause = [];
    
    if (dateFrom && dateTo) {
      whereClause.push(between(timeEntries.date, startOfDay(dateFrom), endOfDay(dateTo)));
    } else if (dateFrom) {
      whereClause.push(gte(timeEntries.date, startOfDay(dateFrom)));
    } else if (dateTo) {
      whereClause.push(lte(timeEntries.date, endOfDay(dateTo)));
    }
    
    if (employeeId) {
      whereClause.push(eq(timeEntries.employeeId, employeeId));
    }
    
    // Calculate pagination
    const offset = (page - 1) * pageSize;
    
    // Get total count first
    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(timeEntries)
      .where(whereClause.length > 0 ? and(...whereClause) : undefined);
    
    const totalEntries = Number(countResult[0].count);
    const totalPages = Math.ceil(totalEntries / pageSize);
    
    // Get paginated entries
    const entries = await db.query.timeEntries.findMany({
      where: whereClause.length > 0 ? and(...whereClause) : undefined,
      orderBy: [desc(timeEntries.date), desc(timeEntries.createdAt)],
      limit: pageSize,
      offset,
    });
    
    // Get employee names
    const entriesWithEmployeeNames = await Promise.all(
      entries.map(async (entry) => {
        const employee = await this.getEmployeeById(entry.employeeId);
        return {
          ...entry,
          employeeName: employee?.name,
        };
      })
    );
    
    return {
      entries: entriesWithEmployeeNames,
      totalEntries,
      totalPages,
      currentPage: page,
      pageSize,
      startIndex: totalEntries > 0 ? offset + 1 : 0,
      endIndex: Math.min(offset + pageSize, totalEntries),
    };
  }

  async getTimeEntryById(id: number): Promise<TimeEntry | undefined> {
    const entry = await db.query.timeEntries.findFirst({
      where: eq(timeEntries.id, id),
    });

    if (!entry) return undefined;

    // Get employee name
    const employee = await this.getEmployeeById(entry.employeeId);

    return {
      ...entry,
      employeeName: employee?.name,
    };
  }

  async updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const currentEntry = await this.getTimeEntryById(id);
    if (!currentEntry) return undefined;

    // Prepare the update data
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // Calculate total hours if both check-in and check-out times are available
    const checkInTime = data.checkInTime || currentEntry.checkInTime;
    const checkOutTime = data.checkOutTime || currentEntry.checkOutTime;
    const breakMinutes = data.breakMinutes !== undefined ? data.breakMinutes : currentEntry.breakMinutes;

    if (checkInTime && checkOutTime) {
      const hours = calculateTotalHours(
        checkInTime,
        checkOutTime,
        breakMinutes || 0
      );
      
      updateData.totalHours = hours !== null ? hours : null;
    }

    // Format the time values to 12-hour format if they exist
    if (data.checkInTime) {
      updateData.checkInTime = formatTime(data.checkInTime);
    }
    
    if (data.checkOutTime) {
      updateData.checkOutTime = formatTime(data.checkOutTime);
    }

    // Update the entry
    const [updatedEntry] = await db.update(timeEntries)
      .set(updateData)
      .where(eq(timeEntries.id, id))
      .returning();

    if (!updatedEntry) return undefined;

    // Get employee name
    const employee = await this.getEmployeeById(updatedEntry.employeeId);

    return {
      ...updatedEntry,
      employeeName: employee?.name,
    };
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await db.delete(timeEntries)
      .where(eq(timeEntries.id, id));
  }

  async checkoutTimeEntry(id: number): Promise<TimeEntry | undefined> {
    const entry = await this.getTimeEntryById(id);
    if (!entry || entry.checkOutTime) return undefined;

    // Get current time for check-out
    const now = new Date();
    const checkOutTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Update the entry with check-out time
    return await this.updateTimeEntry(id, {
      checkOutTime,
    });
  }

  // Report methods
  async generateReport(filters: ReportFilters): Promise<any> {
    const { reportType, dateFrom, dateTo, employeeId } = filters;
    
    // Default date range if not provided
    const defaultDateFrom = subDays(new Date(), 7);
    const defaultDateTo = new Date();
    
    const startDate = dateFrom || defaultDateFrom;
    const endDate = dateTo || defaultDateTo;
    
    // Get all active employees for the chart
    const allEmployees = await db.query.employees.findMany({
      where: eq(employees.status, "active"),
    });
    
    let title = "";
    let chartData: any[] = [];
    let summaryData: any[] = [];
    let employeeTotals = {
      totalDays: 0,
      totalHours: 0,
      avgDailyHours: 0,
      totalBreakMinutes: 0,
    };
    
    switch (reportType) {
      case "daily":
        title = "Daily Summary";
        chartData = await this.getDailyReportData(startDate, endDate, employeeId);
        break;
      case "weekly":
        title = "Weekly Summary";
        chartData = await this.getWeeklyReportData(startDate, endDate, employeeId);
        break;
      case "monthly":
        title = "Monthly Summary";
        chartData = await this.getMonthlyReportData(startDate, endDate, employeeId);
        break;
      case "employee":
      case "custom":
      default:
        title = "Custom Range Summary";
        chartData = await this.getCustomReportData(startDate, endDate, employeeId);
        break;
    }
    
    // Get employee summary data
    summaryData = await this.getEmployeeSummaryData(startDate, endDate, employeeId);
    
    // Calculate totals
    if (summaryData.length > 0) {
      const totalDays = summaryData.reduce((acc, curr) => acc + curr.totalDays, 0);
      const totalHours = summaryData.reduce((acc, curr) => acc + curr.totalHours, 0);
      const totalBreakMinutes = summaryData.reduce((acc, curr) => acc + curr.totalBreakMinutes, 0);
      
      employeeTotals = {
        totalDays,
        totalHours,
        avgDailyHours: totalDays > 0 ? totalHours / totalDays : 0,
        totalBreakMinutes,
      };
    }
    
    return {
      title,
      chartData,
      summaryData,
      employeeTotals,
      employees: allEmployees,
      dateRange: {
        from: formatISO(startDate),
        to: formatISO(endDate),
      },
    };
  }

  private async getDailyReportData(startDate: Date, endDate: Date, employeeId?: number): Promise<any[]> {
    // Build where clause
    let whereClause = [
      between(timeEntries.date, startOfDay(startDate), endOfDay(endDate)),
    ];
    
    if (employeeId) {
      whereClause.push(eq(timeEntries.employeeId, employeeId));
    }
    
    // Get time entries
    const entries = await db.query.timeEntries.findMany({
      where: and(...whereClause),
      orderBy: [timeEntries.date],
    });
    
    // Group by date
    const dateMap = new Map<string, { label: string; values: Record<string, number> }>();
    
    // Initialize all dates in the range
    const dateRange = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = format(current, "yyyy-MM-dd");
      const label = format(current, "EEE, MMM d");
      dateMap.set(dateStr, { label, values: {} });
      dateRange.push(dateStr);
      current.setDate(current.getDate() + 1);
    }
    
    // Populate with actual data
    for (const entry of entries) {
      if (!entry.totalHours) continue;
      
      const dateStr = format(entry.date, "yyyy-MM-dd");
      const dateData = dateMap.get(dateStr);
      
      if (dateData) {
        const empId = entry.employeeId.toString();
        dateData.values[empId] = (dateData.values[empId] || 0) + Number(entry.totalHours);
      }
    }
    
    // Convert map to array
    return dateRange.map(dateStr => dateMap.get(dateStr)).filter(Boolean);
  }

  private async getWeeklyReportData(startDate: Date, endDate: Date, employeeId?: number): Promise<any[]> {
    // Adjust dates to full weeks
    const adjustedStart = startOfWeek(startDate, { weekStartsOn: 1 });
    const adjustedEnd = endOfWeek(endDate, { weekStartsOn: 1 });
    
    // Build where clause
    let whereClause = [
      between(timeEntries.date, startOfDay(adjustedStart), endOfDay(adjustedEnd)),
    ];
    
    if (employeeId) {
      whereClause.push(eq(timeEntries.employeeId, employeeId));
    }
    
    // Get time entries
    const entries = await db.query.timeEntries.findMany({
      where: and(...whereClause),
      orderBy: [timeEntries.date],
    });
    
    // Group by week
    const weekMap = new Map<string, { label: string; values: Record<string, number> }>();
    
    // Initialize all weeks in the range
    const weekRange = [];
    const current = new Date(adjustedStart);
    while (current <= adjustedEnd) {
      const weekStart = startOfWeek(current, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(current, { weekStartsOn: 1 });
      const weekStr = format(weekStart, "yyyy-MM-dd");
      const label = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`;
      
      if (!weekMap.has(weekStr)) {
        weekMap.set(weekStr, { label, values: {} });
        weekRange.push(weekStr);
      }
      
      current.setDate(current.getDate() + 7);
    }
    
    // Populate with actual data
    for (const entry of entries) {
      if (!entry.totalHours) continue;
      
      const weekStart = startOfWeek(entry.date, { weekStartsOn: 1 });
      const weekStr = format(weekStart, "yyyy-MM-dd");
      const weekData = weekMap.get(weekStr);
      
      if (weekData) {
        const empId = entry.employeeId.toString();
        weekData.values[empId] = (weekData.values[empId] || 0) + Number(entry.totalHours);
      }
    }
    
    // Convert map to array
    return weekRange.map(weekStr => weekMap.get(weekStr)).filter(Boolean);
  }

  private async getMonthlyReportData(startDate: Date, endDate: Date, employeeId?: number): Promise<any[]> {
    // Adjust dates to full months
    const adjustedStart = startOfMonth(startDate);
    const adjustedEnd = endOfMonth(endDate);
    
    // Build where clause
    let whereClause = [
      between(timeEntries.date, startOfDay(adjustedStart), endOfDay(adjustedEnd)),
    ];
    
    if (employeeId) {
      whereClause.push(eq(timeEntries.employeeId, employeeId));
    }
    
    // Get time entries
    const entries = await db.query.timeEntries.findMany({
      where: and(...whereClause),
      orderBy: [timeEntries.date],
    });
    
    // Group by month
    const monthMap = new Map<string, { label: string; values: Record<string, number> }>();
    
    // Initialize all months in the range
    const monthRange = [];
    const current = new Date(adjustedStart);
    while (current <= adjustedEnd) {
      const monthStart = startOfMonth(current);
      const monthStr = format(monthStart, "yyyy-MM");
      const label = format(monthStart, "MMMM yyyy");
      
      if (!monthMap.has(monthStr)) {
        monthMap.set(monthStr, { label, values: {} });
        monthRange.push(monthStr);
      }
      
      current.setMonth(current.getMonth() + 1);
    }
    
    // Populate with actual data
    for (const entry of entries) {
      if (!entry.totalHours) continue;
      
      const monthStr = format(entry.date, "yyyy-MM");
      const monthData = monthMap.get(monthStr);
      
      if (monthData) {
        const empId = entry.employeeId.toString();
        monthData.values[empId] = (monthData.values[empId] || 0) + Number(entry.totalHours);
      }
    }
    
    // Convert map to array
    return monthRange.map(monthStr => monthMap.get(monthStr)).filter(Boolean);
  }

  private async getCustomReportData(startDate: Date, endDate: Date, employeeId?: number): Promise<any[]> {
    // For custom reports, we'll use the daily report data
    return this.getDailyReportData(startDate, endDate, employeeId);
  }

  private async getEmployeeSummaryData(startDate: Date, endDate: Date, employeeId?: number): Promise<any[]> {
    // Get employees to report on
    const employeesToReport = employeeId 
      ? [await this.getEmployeeById(employeeId)].filter(Boolean) 
      : await db.query.employees.findMany({
          where: eq(employees.status, "active"),
        });
    
    const summaryData = [];
    
    for (const employee of employeesToReport) {
      // Get time entries for this employee
      const entries = await db.query.timeEntries.findMany({
        where: and(
          eq(timeEntries.employeeId, employee.id),
          between(timeEntries.date, startOfDay(startDate), endOfDay(endDate))
        ),
      });
      
      // Skip if no entries
      if (entries.length === 0) continue;
      
      // Calculate summary
      const workingDays = entries.filter(e => e.totalHours !== null).length;
      const totalHours = entries.reduce((acc, curr) => acc + (curr.totalHours ? Number(curr.totalHours) : 0), 0);
      const totalBreakMinutes = entries.reduce((acc, curr) => acc + (curr.breakMinutes || 0), 0);
      
      summaryData.push({
        employeeId: employee.id,
        employeeName: employee.name,
        totalDays: workingDays,
        totalHours,
        avgDailyHours: workingDays > 0 ? totalHours / workingDays : 0,
        totalBreakMinutes,
      });
    }
    
    return summaryData;
  }

  // Dashboard methods
  async getDashboardStats(date: Date): Promise<DashboardStats> {
    // Get time entries for today
    const todayEntries = await this.getTimeEntriesByDate(date);
    
    // Get total hours
    const totalHours = todayEntries.reduce((acc, curr) => acc + (curr.totalHours ? Number(curr.totalHours) : 0), 0);
    
    // Get active employees count
    const activeEmployees = await db.query.employees.findMany({
      where: eq(employees.status, "active"),
    });
    
    // Get checked-in count (entries with no check-out time)
    const checkedInCount = todayEntries.filter(entry => !entry.checkOutTime).length;
    
    // Calculate average hours per employee
    const avgHoursPerEmployee = activeEmployees.length > 0 ? totalHours / activeEmployees.length : 0;
    
    // Get weekly average hours
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    
    const weekEntries = await db.query.timeEntries.findMany({
      where: between(timeEntries.date, startOfDay(weekStart), endOfDay(weekEnd)),
    });
    
    const weeklyTotalHours = weekEntries.reduce((acc, curr) => acc + (curr.totalHours ? Number(curr.totalHours) : 0), 0);
    const workDaysInWeek = 5; // Excluding weekends
    const weeklyAvgHours = activeEmployees.length > 0 ? weeklyTotalHours / (activeEmployees.length * workDaysInWeek) : 0;
    
    return {
      totalHours: parseFloat(totalHours.toFixed(2)),
      activeEmployees: activeEmployees.length,
      checkedInCount,
      avgHoursPerEmployee: parseFloat(avgHoursPerEmployee.toFixed(2)),
      weeklyAvgHours: parseFloat(weeklyAvgHours.toFixed(2)),
    };
  }
}

export const storage = new DatabaseStorage();
