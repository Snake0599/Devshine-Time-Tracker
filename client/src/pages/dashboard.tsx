import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SidebarNav } from "@/components/sidebar-nav";
import { TimeEntryForm } from "@/components/ui/time-entry-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { TimeEntry } from "@shared/schema";
import { Edit, Trash2, UserCheck, ClockIcon, Users, BarChart } from "lucide-react";

export default function Dashboard() {
  const isMobile = useMobile();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard", selectedDate],
  });

  // Today's entries are part of the dashboard data
  const todaysEntries = dashboardData?.entries || [];

  // Date change handler
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  // Go to date handler
  const handleGoToDate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard", selectedDate] });
    toast({
      title: "Date changed",
      description: `Viewing data for ${format(new Date(selectedDate), "PPP")}`,
    });
  };

  // Delete time entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      await apiRequest("DELETE", `/api/time-entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Time entry deleted",
        description: "The time entry has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check out handler
  const checkOutMutation = useMutation({
    mutationFn: async (entryId: number) => {
      await apiRequest("POST", `/api/time-entries/${entryId}/checkout`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Checked out",
        description: "The employee has been successfully checked out.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle entry delete
  const handleDeleteEntry = (entryId: number) => {
    if (window.confirm("Are you sure you want to delete this time entry?")) {
      deleteMutation.mutate(entryId);
    }
  };

  // Handle check out
  const handleCheckOut = (entryId: number) => {
    checkOutMutation.mutate(entryId);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />
      
      <div className="flex flex-1">
        {/* Sidebar (hidden on mobile) */}
        {!isMobile && <SidebarNav />}
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
              <p className="mt-1 text-sm text-gray-600">Overview of employee time tracking</p>
            </div>

            {/* Date Selector */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="font-medium">
                    Today: <span>{format(new Date(), "PPPP")}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                    <div className="flex items-center">
                      <label htmlFor="date-selector" className="mr-2 text-sm font-medium text-gray-700">Date:</label>
                      <input 
                        type="date" 
                        id="date-selector" 
                        className="custom-date-input rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" 
                        value={selectedDate}
                        onChange={handleDateChange}
                      />
                    </div>
                    <Button onClick={handleGoToDate}>
                      Go to Date
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="border-t-4 border-primary">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Hours Today</p>
                      <p className="text-3xl font-semibold text-gray-900">
                        {isLoading ? "..." : dashboardData?.stats?.totalHours || "0"}
                      </p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-full">
                      <ClockIcon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">All employees combined</p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-secondary">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Active Employees</p>
                      <p className="text-3xl font-semibold text-gray-900">
                        {isLoading ? "..." : dashboardData?.stats?.activeEmployees || "0"}
                      </p>
                    </div>
                    <div className="bg-indigo-100 p-3 rounded-full">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Currently checked in: {isLoading ? "..." : dashboardData?.stats?.checkedInCount || "0"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-green-500">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Avg. Hours Per Employee</p>
                      <p className="text-3xl font-semibold text-gray-900">
                        {isLoading ? "..." : dashboardData?.stats?.avgHoursPerEmployee || "0"}
                      </p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-full">
                      <BarChart className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    This week: {isLoading ? "..." : dashboardData?.stats?.weeklyAvgHours || "0"} hours avg.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Add Time Entry */}
            <div className="mb-6">
              <TimeEntryForm />
            </div>

            {/* Today's Entries */}
            <Card>
              <CardHeader className="border-b border-gray-200">
                <CardTitle>Today's Entries</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Break (min)</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          Loading time entries...
                        </TableCell>
                      </TableRow>
                    ) : todaysEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No time entries for today.
                        </TableCell>
                      </TableRow>
                    ) : (
                      todaysEntries.map((entry: TimeEntry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {entry.employeeName}
                          </TableCell>
                          <TableCell>{entry.checkInTime}</TableCell>
                          <TableCell>
                            {entry.checkOutTime || "--:-- --"}
                          </TableCell>
                          <TableCell>{entry.breakMinutes}</TableCell>
                          <TableCell>
                            {entry.totalHours !== null ? entry.totalHours.toFixed(2) : "--"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={entry.checkOutTime ? "completed" : "in progress"} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!entry.checkOutTime ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleCheckOut(entry.id)}
                                >
                                  <UserCheck className="h-4 w-4 mr-1" />
                                  Check Out
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                              )}
                              <Button 
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-900"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
