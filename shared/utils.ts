/**
 * Format a time string (HH:MM) for input elements
 */
export function formatTimeForInput(timeString: string): string {
  if (!timeString) return "";

  // Handle AM/PM format
  if (timeString.includes("AM") || timeString.includes("PM")) {
    const [timePart, period] = timeString.split(" ");
    const [hours, minutes] = timePart.split(":");
    let hourNum = parseInt(hours, 10);

    if (period === "PM" && hourNum < 12) {
      hourNum += 12;
    } else if (period === "AM" && hourNum === 12) {
      hourNum = 0;
    }

    return `${hourNum.toString().padStart(2, "0")}:${minutes}`;
  }

  // Already in 24-hour format
  return timeString;
}

/**
 * Convert time string to minutes since midnight
 */
export function timeToMinutes(timeString: string): number {
  const formattedTime = formatTimeForInput(timeString);
  const [hours, minutes] = formattedTime.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate total hours between check-in and check-out, minus break time
 */
export function calculateTotalHours(
  checkInTime: string,
  checkOutTime: string,
  breakMinutes: number
): number | null {
  if (!checkInTime || !checkOutTime) return null;

  const checkInMinutes = timeToMinutes(checkInTime);
  const checkOutMinutes = timeToMinutes(checkOutTime);

  if (checkOutMinutes <= checkInMinutes) {
    // Handle case where check-out is on the next day
    return (24 * 60 + checkOutMinutes - checkInMinutes - breakMinutes) / 60;
  }

  return (checkOutMinutes - checkInMinutes - breakMinutes) / 60;
}

/**
 * Format minutes to hours and minutes string (e.g., "5h 30m")
 */
export function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/**
 * Format date to display string
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Format time from 24-hour to 12-hour format
 */
export function formatTime(time: string): string {
  if (!time) return "";
  
  // If already in 12-hour format, return as is
  if (time.includes("AM") || time.includes("PM")) {
    return time;
  }

  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Get date range array between two dates
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}
