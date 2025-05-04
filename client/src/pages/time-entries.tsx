import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeEntryForm } from "@/components/ui/time-entry-form";
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
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { TimeEntry } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";

export default function TimeEntries() {
  const isMobile = useMobile();
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [employeeId, setEmployeeId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);

  // Fetch time entries with filters
  const { data, isLoading } = useQuery({
    queryKey: ["/api/time-entries", { dateFrom, dateTo, employeeId, page: currentPage }],
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (employeeId && employeeId !== "all_employees") params.append('employeeId', employeeId);
      params.append('page', currentPage.toString());
      
      const url = `/api/time-entries?${params.toString()}`;
      console.log('Fetching time entries with URL:', url);
      
      const res = await fetch(url);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Time entries API error:', errorText);
        throw new Error(errorText);
      }
      return res.json();
    }
  });

  const timeEntries = data?.entries || [];
  const totalPages = data?.totalPages || 1;

  // Fetch employees for filter dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
  });

  // Apply filters handler
  const handleApplyFilters = () => {
    setCurrentPage(1);
    // Only pass employeeId if it's not 'all_employees'
    const employeeIdParam = employeeId !== "all_employees" ? employeeId : undefined;
    queryClient.invalidateQueries({ 
      queryKey: ["/api/time-entries", { dateFrom, dateTo, employeeId: employeeIdParam, page: 1 }] 
    });
  };

  // Delete time entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      await apiRequest("DELETE", `/api/time-entries/${entryId}`);
    },
    onSuccess: () => {
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

  // Handle entry delete
  const handleDeleteEntry = (entryId: number) => {
    if (window.confirm("Are you sure you want to delete this time entry?")) {
      deleteMutation.mutate(entryId);
    }
  };

  // Handle edit entry
  const handleEditEntry = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setIsAddDialogOpen(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setSelectedEntry(null);
    setIsAddDialogOpen(false);
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  // Generate pagination buttons
  const getPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 3;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <Button
          key={i}
          variant={currentPage === i ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageClick(i)}
          className="h-8 w-8 p-0"
        >
          {i}
        </Button>
      );
    }
    
    return buttons;
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
              <h2 className="text-2xl font-semibold text-gray-900">Time Entries</h2>
              <p className="mt-1 text-sm text-gray-600">View and manage employee time records</p>
            </div>

            {/* Date Range Filter */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="date-from" className="block text-sm font-medium text-gray-700">From</label>
                    <Input
                      type="date"
                      id="date-from"
                      className="custom-date-input"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="date-to" className="block text-sm font-medium text-gray-700">To</label>
                    <Input
                      type="date"
                      id="date-to"
                      className="custom-date-input"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="employee-filter" className="block text-sm font-medium text-gray-700">Employee</label>
                    <Select value={employeeId} onValueChange={setEmployeeId}>
                      <SelectTrigger id="employee-filter">
                        <SelectValue placeholder="All Employees" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_employees">All Employees</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleApplyFilters}>
                    Apply Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Time Entries List */}
            <Card>
              <CardHeader className="border-b border-gray-200 flex md:flex-row flex-col gap-4 md:items-center md:justify-between">
                <CardTitle>Time Records</CardTitle>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Entry
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Break (min)</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4">
                          Loading time entries...
                        </TableCell>
                      </TableRow>
                    ) : timeEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4">
                          No time entries found for the selected criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      timeEntries.map((entry: TimeEntry) => {
                        const entryDate = new Date(entry.date);
                        const dayName = format(entryDate, "EEEE");
                        const isWeekend = dayName === "Saturday" || dayName === "Sunday";
                        
                        return (
                          <TableRow key={entry.id} className={isWeekend ? "bg-gray-50" : ""}>
                            <TableCell>
                              {format(entryDate, "MMM dd, yyyy")}
                            </TableCell>
                            <TableCell>
                              {dayName}
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.employeeName}
                            </TableCell>
                            <TableCell>
                              {isWeekend ? "--:-- --" : entry.checkInTime}
                            </TableCell>
                            <TableCell>
                              {isWeekend ? "--:-- --" : (entry.checkOutTime || "--:-- --")}
                            </TableCell>
                            <TableCell>
                              {isWeekend ? "--" : entry.breakMinutes}
                            </TableCell>
                            <TableCell>
                              {isWeekend ? "--" : 
                                (entry.totalHours !== null && entry.totalHours !== undefined 
                                  ? (typeof entry.totalHours === 'number' 
                                    ? entry.totalHours.toFixed(2) 
                                    : Number(entry.totalHours).toFixed(2))
                                  : "--")}
                            </TableCell>
                            <TableCell>
                              {isWeekend ? (
                                <StatusBadge status="off day" />
                              ) : (
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-indigo-600 hover:text-indigo-900"
                                    onClick={() => handleEditEntry(entry)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
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
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-700">
                    {data?.totalEntries ? (
                      <>
                        Showing <span className="font-medium">{data.startIndex}</span> to <span className="font-medium">{data.endIndex}</span> of <span className="font-medium">{data.totalEntries}</span> entries
                      </>
                    ) : (
                      "No entries found"
                    )}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex justify-end">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrevPage}
                          disabled={currentPage === 1}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only">Previous</span>
                        </Button>
                        
                        {getPaginationButtons()}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">Next</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Add/Edit Time Entry Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedEntry ? "Edit Time Entry" : "Add New Time Entry"}</DialogTitle>
          </DialogHeader>
          <TimeEntryForm 
            timeEntry={selectedEntry || undefined} 
            onSuccess={handleFormClose} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
