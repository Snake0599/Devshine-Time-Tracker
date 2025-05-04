import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  CartesianGrid 
} from "recharts";

// Report type options
const reportTypes = [
  { value: "daily", label: "Daily Summary" },
  { value: "weekly", label: "Weekly Summary" },
  { value: "monthly", label: "Monthly Summary" },
  { value: "employee", label: "Employee Summary" },
  { value: "custom", label: "Custom Range" },
];

export default function Reports() {
  const isMobile = useMobile();
  const [reportType, setReportType] = useState("weekly");
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [employeeId, setEmployeeId] = useState<string>("");
  
  // Fetch report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["/api/reports", { reportType, dateFrom, dateTo, employeeId }],
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      params.append('reportType', reportType);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (employeeId && employeeId !== "all_employees") params.append('employeeId', employeeId);
      
      const url = `/api/reports?${params.toString()}`;
      console.log('Fetching reports with URL:', url);
      
      const res = await fetch(url);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Reports API error:', errorText);
        throw new Error(errorText);
      }
      return res.json();
    }
  });

  // Fetch employees for filter dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
  });

  // Handle generate report
  const handleGenerateReport = () => {
    // Only pass employeeId if it's not 'all_employees'
    const employeeIdParam = employeeId !== "all_employees" ? employeeId : undefined;
    queryClient.invalidateQueries({ 
      queryKey: ["/api/reports", { reportType, dateFrom, dateTo, employeeId: employeeIdParam }] 
    });
  };

  // Format chart data
  const getChartData = () => {
    if (!reportData?.chartData) return [];
    
    return reportData.chartData.map((item: any) => ({
      name: item.label,
      ...item.values
    }));
  };

  // Format time (minutes to hours and minutes)
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const chartData = getChartData();
  const summaryData = reportData?.summaryData || [];
  const employeeTotals = reportData?.employeeTotals || {};

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
              <h2 className="text-2xl font-semibold text-gray-900">Reports</h2>
              <p className="mt-1 text-sm text-gray-600">Generate and view time reports</p>
            </div>

            {/* Report Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="report-type" className="block text-sm font-medium text-gray-700">Report Type</label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger id="report-type">
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="report-from" className="block text-sm font-medium text-gray-700">From Date</label>
                    <Input
                      type="date"
                      id="report-from"
                      className="custom-date-input"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="report-to" className="block text-sm font-medium text-gray-700">To Date</label>
                    <Input
                      type="date"
                      id="report-to"
                      className="custom-date-input"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="report-employee" className="block text-sm font-medium text-gray-700">Employee</label>
                    <Select value={employeeId} onValueChange={setEmployeeId}>
                      <SelectTrigger id="report-employee">
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
                  <Button onClick={handleGenerateReport}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Report Summary */}
            {!isLoading && reportData && (
              <>
                <Card className="mb-6">
                  <CardHeader className="border-b border-gray-200">
                    <CardTitle>
                      {reportData.title} ({format(new Date(dateFrom), "MMM dd, yyyy")} - {format(new Date(dateTo), "MMM dd, yyyy")})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                          <Tooltip formatter={(value) => [`${value} hours`]} />
                          <Legend />
                          {reportData.employees && reportData.employees.map((employee: any, index: number) => (
                            <Bar 
                              key={employee.id} 
                              dataKey={employee.id.toString()} 
                              name={employee.name} 
                              fill={`hsl(${(index * 30) % 360}, 70%, 60%)`} 
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                  <div className="px-6 py-3 bg-gray-50 text-right">
                    <Button variant="link" className="text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export as CSV
                    </Button>
                  </div>
                </Card>

                {/* Employee Hours Table */}
                <Card>
                  <CardHeader className="border-b border-gray-200">
                    <CardTitle>Employee Hours Summary</CardTitle>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Total Days</TableHead>
                          <TableHead>Total Hours</TableHead>
                          <TableHead>Avg. Daily Hours</TableHead>
                          <TableHead>Break Time (total)</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4">
                              No data available for the selected criteria.
                            </TableCell>
                          </TableRow>
                        ) : (
                          summaryData.map((item: any) => (
                            <TableRow key={item.employeeId}>
                              <TableCell className="font-medium">
                                {item.employeeName}
                              </TableCell>
                              <TableCell>
                                {item.totalDays}
                              </TableCell>
                              <TableCell>
                                {item.totalHours.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {item.avgDailyHours.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {formatTime(item.totalBreakMinutes)}
                              </TableCell>
                              <TableCell>
                                <Button variant="link" className="text-primary">
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      {summaryData.length > 0 && (
                        <TableFooter>
                          <TableRow>
                            <TableCell className="font-medium">Totals</TableCell>
                            <TableCell>{employeeTotals.totalDays || 0}</TableCell>
                            <TableCell>{employeeTotals.totalHours?.toFixed(2) || 0}</TableCell>
                            <TableCell>{employeeTotals.avgDailyHours?.toFixed(2) || 0}</TableCell>
                            <TableCell>{formatTime(employeeTotals.totalBreakMinutes || 0)}</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
